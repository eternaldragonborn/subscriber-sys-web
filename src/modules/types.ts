import { DateTime } from "luxon";

interface SubscriberData {
    subscriber: string;
    priview_url: string;
    download_url: string;
    addTime: DateTime;
}

export interface ArtistData {
    artist: string;
    subscriber: string;
    lastUpdateTime: DateTime;
    mark?: string;
    status: number;
}

export interface SubscribeData {
    subscribers: {[id: string]: SubscriberData};
    artists: ArtistData[];
}