// clipboard files often arrive nameless, so give them something to show and download as
function fileName(file: File, type: string): string {
    if (file.name) return file.name;
    const ext = type.split('/')[1]?.split('+')[0] || 'bin';
    return `pasted-${Date.now()}.${ext}`;
}

// an attachment has one shape everywhere - client, api, and db:
//   type     bare mime type, eg "image/png"
//   content  full data url, eg "data:image/png;base64,iVBOR..."
//   name     filename, never empty
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

    // the only way to build one from a picked, pasted, or dropped file
    static fromFile(file: File): Promise<Attachment> {
        const type = file.type || 'application/octet-stream';

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error ?? new Error(`could not read ${file.name}`));
            reader.onload = () => {
                // rebuild the data url so type and content always agree, even when the
                // browser hands us a file with no mime type
                const base64 = (reader.result as string).split(',')[1] ?? '';
                resolve(new Attachment('', type, fileName(file, type), `data:${type};base64,${base64}`));
            };
            reader.readAsDataURL(file);
        });
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
    updated_on: Date | null;

    constructor(uuid: string, parent_id: string, quest_parent_id: string, title: string, description: string, due: string, status: QuestStatus, done: boolean, updated_on: Date | null = null) {
        this.uuid = uuid;
        this.parent_id = parent_id;
        this.quest_parent_id = quest_parent_id;
        this.title = title;
        this.description = description;
        this.due = due;
        this.status = status;
        this.done = done;
        this.updated_on = updated_on;
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
        const updated_on = q.properties.updatedOn ? new Date(q.properties.updatedOn.toString()) : null;
        return new Quest(uuid, parent_id, quest_parent_id, title, description, due, status, done, updated_on);
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
