import { objectToURI } from ".";

export interface FetchResponse {
    responseText: string;
    status: number;
    ok: boolean;
}

/**
 * Sends a request to the specified url
 *
 * @param type The request type "GET", "POST", etc.
 * @param address The address to add to the SponsorBlock server address
 * @param callback
 */
export async function sendRealRequestToCustomServer(type: string, url: string, data: {} | null = {}) {
    // If GET, convert JSON to parameters
    if (type.toLowerCase() === "get") {
        url = objectToURI(url, data, true);

        data = null;
    }

    const response = await fetch(url, {
        method: type,
        credentials: "omit",
        headers: {
            'Content-Type': 'application/json'
        },
        redirect: 'follow',
        body: data ? JSON.stringify(data) : null
    });

    return response;
}

export function setupBackgroundRequestProxy() {
    chrome.runtime.onMessage.addListener((request, sender, callback) => {
        // Only allow messages from extension pages.
        if (sender.origin !== location.origin) return false;
        if (request.message === "sendRequest") {
            sendRealRequestToCustomServer(request.type, request.url, request.data).then(async (response) => {
                callback({
                    responseText: await response.text(),
                    status: response.status,
                    ok: response.ok
                });
            }).catch(() => {
                callback({
                    responseText: "",
                    status: -1,
                    ok: false
                });
            });

            return true;
        }

        return false;
    });
}

export function sendRequestToCustomServer(type: string, url: string, data = {}): Promise<FetchResponse> {
    return new Promise((resolve, reject) => {
        // Ask the background script to do the work
        chrome.runtime.sendMessage({
            message: "sendRequest",
            type,
            url,
            data
        }, (response) => {
            if (response.status !== -1) {
                resolve(response);
            } else {
                reject(response);
            }
        });
    });
}
