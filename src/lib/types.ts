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

export class Note {
    uuid: string;
    content: string;

    constructor(uuid: string, content: string) {
        this.uuid = uuid;
        this.content = content;
    }

    static fromJSON(json: any): Note {
        return new Note(json.uuid, json.content);
    }

    static fromWeaviate(n: any): Note {
        let uuid = n.uuid;
        let content = n.properties.content?.toString() || "";

        return new Note(uuid, content);
    }
}

export type QuestStatus = 'active' | 'inactive' | 'completed' | 'aborted' | 'locked';

export class Quest {
    uuid: string;
    parent_id: string;
    quest_parent_id: string;
    title: string;
    description: string;
    due: string;
    status: QuestStatus;
    done: boolean;

    constructor(uuid: string, parent_id: string, quest_parent_id: string, title: string, description: string, due: string, status: QuestStatus, done: boolean) {
        this.uuid = uuid;
        this.parent_id = parent_id;
        this.quest_parent_id = quest_parent_id;
        this.title = title;
        this.description = description;
        this.due = due;
        this.status = status;
        this.done = done;
    }

    static fromWeaviate(q: any): Quest {
        const uuid = q.uuid;
        const parent_id = q.references?.belongsTo?.objects?.[0]?.uuid || '';
        const quest_parent_id = q.properties.questParentId?.toString() || '';
        const title = q.properties.title?.toString() || '';
        const description = q.properties.description?.toString() || '';
        const due = q.properties.due?.toString() || '';
        const status = (q.properties.status?.toString() || 'active') as QuestStatus;
        const done = q.properties.done || false;
        return new Quest(uuid, parent_id, quest_parent_id, title, description, due, status, done);
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
