import type { Attachment } from "./types";

export class Message {
    uuid: string;
    content: string;
    timestamp: Date;
    attachments: Attachment[] = [];

    constructor(uuid: string, content: string, timestamp: Date) {
        this.uuid = uuid;
        this.content = content;
        this.timestamp = timestamp;
    }

    static fromJSON(json: any): Message {
        return new Message(json.uuid, json.content, json.timestamp);
    }

    static fromWeaviate(m: any): Message {
        let uuid = m.uuid;
        let content = m.properties.content?.toString() || "";
        let timestamp = new Date(m.properties.timestamp?.toString() || "");

        return new Message(uuid, content, timestamp);
    }
}
