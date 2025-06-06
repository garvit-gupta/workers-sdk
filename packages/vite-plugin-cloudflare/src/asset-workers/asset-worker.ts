// @ts-ignore
import AssetWorker from "@cloudflare/workers-shared/dist/asset-worker.mjs";
import { UNKNOWN_HOST } from "../shared";

interface Env {
	__VITE_ASSET_EXISTS__: Fetcher;
	__VITE_FETCH_ASSET__: Fetcher;
}

export default class CustomAssetWorker extends AssetWorker {
	async fetch(request: Request): Promise<Response> {
		const response = await super.fetch!(request);
		const modifiedResponse = new Response(response.body, response);
		modifiedResponse.headers.delete("ETag");
		modifiedResponse.headers.delete("Cache-Control");

		return modifiedResponse;
	}
	async unstable_getByETag(
		eTag: string
	): Promise<{ readableStream: ReadableStream; contentType: string }> {
		const url = new URL(eTag, UNKNOWN_HOST);
		const response = await (
			this as typeof AssetWorker as { env: Env }
		).env.__VITE_FETCH_ASSET__.fetch(url);

		if (!response.body) {
			throw new Error(`Unexpected error. No HTML found for ${eTag}.`);
		}

		return { readableStream: response.body, contentType: "text/html" };
	}
	async unstable_exists(pathname: string): Promise<string | null> {
		// We need this regex to avoid getting `//` as a pathname, which results in an invalid URL. Should this be fixed upstream?
		const url = new URL(pathname.replace(/^\/{2,}/, "/"), UNKNOWN_HOST);
		const response = await (
			this as typeof AssetWorker as { env: Env }
		).env.__VITE_ASSET_EXISTS__.fetch(url);
		const exists = await response.json();

		return exists ? pathname : null;
	}
	async unstable_canFetch(request: Request) {
		// the 'sec-fetch-mode: navigate' header is stripped by something on its way into this worker
		// so we restore it from 'x-mf-sec-fetch-mode'
		const secFetchMode = request.headers.get("X-Mf-Sec-Fetch-Mode");
		if (secFetchMode) {
			request.headers.set("Sec-Fetch-Mode", secFetchMode);
		}
		return await super.unstable_canFetch(request);
	}
}
