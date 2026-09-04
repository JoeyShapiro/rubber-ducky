export function formatDate(date: Date): string {
    date = new Date(date); // shrug
    const now = new Date();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes.toString().padStart(2, '0');

    if (date.toDateString() === now.toDateString()) {
        return `today at ${formattedHours}:${formattedMinutes} ${ampm}`;
    } else if (date.getTime() - now.getTime() < 24 * 60 * 60 * 1000 &&
        date.getTime() > now.getTime()) {
        return `tomorrow at ${formattedHours}:${formattedMinutes} ${ampm}`;
    } else if (now.getTime() - date.getTime() < 24 * 60 * 60 * 1000 &&
        date.getTime() < now.getTime()) {
        return `yesterday at ${formattedHours}:${formattedMinutes} ${ampm}`;
    } else {
        return date.toLocaleDateString() + ` at ${formattedHours}:${formattedMinutes} ${ampm}`;
    }
}
