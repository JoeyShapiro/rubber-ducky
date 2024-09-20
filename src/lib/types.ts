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
