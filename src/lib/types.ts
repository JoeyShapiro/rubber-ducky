export class Attachment {
    uuid: string;
    type: string;
    content: string;
    name: string;

    constructor(uuid: string, type: string, name: string, content: string) {
        this.uuid = uuid;
        this.type = type;
        this.name = name;
        this.content = content;
    }

    static toJSON(attachment: Attachment): any {
        return {
            uuid: attachment.uuid,
            name: attachment.name,
            content: attachment.content
        }
    }

    static fromJSON(json: any): Attachment {
        return new Attachment(json.uuid, json.type, json.name, json.content);
    }

    static fromWeaviate(a: any): Attachment {
        let uuid = a.uuid;
        let name = a.properties.name?.toString() || "";
        let type = a.properties.type?.toString() || "";
        let content = a.properties.content?.toString() || "";

        return new Attachment(uuid, type, name, content);
    }
}

export class Message {
    uuid: string;
    from: string;
    content: string;
    timestamp: Date;
    attachments: Attachment[] = [];

    constructor(uuid: string, from: string, content: string, timestamp: Date) {
        this.uuid = uuid;
        this.from = from;
        this.content = content;
        this.timestamp = timestamp;
    }

    static fromJSON(json: any): Message {
        return new Message(json.uuid, json.from, json.content, json.timestamp);
    }

    static fromWeaviate(m: any): Message {
        let uuid = m.uuid;
        let from = m.properties.from?.toString() || "";
        let content = m.properties.content?.toString() || "";
        let timestamp = new Date(m.properties.timestamp?.toString() || "");

        return new Message(uuid, from, content, timestamp);
    }
}

export class Duck {
    uuid: string;
    name: string;

    constructor(uuid: string, name: string) {
        this.uuid = uuid;
        this.name = name;
    }
}

export class Badling {
    uuid: string;
    name: string;
    ducks: Duck[];

    constructor(uuid: string, name: string) {
        this.uuid = uuid;
        this.name = name;
        this.ducks = [];
    }
}
