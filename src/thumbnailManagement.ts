import { waitFor } from ".";
import { isOnInvidious } from "./video";

export type ThumbnailListener = (newThumbnails: HTMLElement[]) => void;

const handledThumbnails = new Map<HTMLElement, MutationObserver>();
let lastGarbageCollection = 0;
let thumbnailListener: ThumbnailListener | null = null;
let selector = "ytd-thumbnail, ytd-playlist-thumbnail";
let invidiousSelector = "div.thumbnail";

export function setThumbnailListener(listener: ThumbnailListener, onInitialLoad: () => void,
        configReady: () => boolean, selectorParam?: string,
            invidiousSelectorParam?: string): void {
    thumbnailListener = listener;
    if (selectorParam) selector = selectorParam;
    if (invidiousSelectorParam) invidiousSelector = invidiousSelectorParam;

    const onLoad = () => {
        onInitialLoad?.();

        // Label thumbnails on load if on Invidious (wait for variable initialization before checking)
        waitFor(() => isOnInvidious() !== null).then(() => {
            if (isOnInvidious()) newThumbnails();
        });
    };

    if (document.readyState === "complete") {
        onLoad();
    } else {
        window.addEventListener("load", onLoad);
    }

    waitFor(() => configReady(), 5000, 10).then(() => {
        newThumbnails();
    });
}

export function newThumbnails(): HTMLElement[] {
    const notNewThumbnails = handledThumbnails.keys();

    const thumbnails = document.querySelectorAll(isOnInvidious() ? invidiousSelector : selector) as NodeListOf<HTMLElement>;
    const newThumbnails: HTMLElement[] = [];
    for (const thumbnail of thumbnails) {
        if (!handledThumbnails.has(thumbnail)) {
            newThumbnails.push(thumbnail);
            
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === "attributes" && mutation.attributeName === "href") {
                        thumbnailListener?.([thumbnail]);
                        break;
                    }
                }
            });
            handledThumbnails.set(thumbnail, observer);

            const link = thumbnail.querySelector("ytd-thumbnail a");
            if (link) observer.observe(link, { attributes: true });
        }
    }

    thumbnailListener?.(newThumbnails);

    if (performance.now() - lastGarbageCollection > 5000) {
        // Clear old ones (some will come back if they are still on the page)
        // But are handled by happening to be when new ones are added too
        for (const thumbnail of notNewThumbnails) {
            if (!document.body.contains(thumbnail)) {
                const observer = handledThumbnails.get(thumbnail);
                observer?.disconnect();
                handledThumbnails.delete(thumbnail);
            }
        }
    }

    return newThumbnails;
}

export function updateAll(): void {
    if (thumbnailListener) thumbnailListener([...handledThumbnails.keys()]);
}