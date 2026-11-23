// Plain HTML notices: in place of the game when it can't start at all, or
// over it with a button (the keyboard note on phones and tablets). They don't
// use Phaser, so they can't fail the way the game did, and their text stays
// readable however small the game is scaled. The page's own "needs
// JavaScript" notice (index.html) has the same look (style.css).

function noticeElement(title: string, text: string): HTMLDivElement {
    const notice = document.createElement('div');
    notice.className = 'notice';
    const heading = document.createElement('h1');
    heading.id = 'notice-title';
    heading.textContent = title;
    const body = document.createElement('p');
    body.textContent = text;
    notice.append(heading, body);
    return notice;
}

/** Shows a heading and a line of text where the game would be. */
export function showNotice(title: string, text: string): void {
    const notice = noticeElement(title, text);
    notice.setAttribute('role', 'alert');
    // Anything Phaser managed to add before it gave up goes.
    (document.getElementById('game') ?? document.body).replaceChildren(notice);
}

/**
 * Shows a heading and a line of text over the game, with one button that
 * closes it and then calls `closed`. The game keeps loading underneath; no
 * key reaches it while the notice is up.
 */
export function showNoticeOver(title: string, text: string, button: string, closed: () => void): void {
    const notice = noticeElement(title, text);
    notice.setAttribute('role', 'dialog');
    notice.setAttribute('aria-modal', 'true');
    notice.setAttribute('aria-labelledby', 'notice-title');
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = button;
    notice.append(close);

    // Phaser listens for keys on the window: stop them on the way there, including
    // the Enter or Space that presses the button.
    const blockKeys = (event: KeyboardEvent): void => {
        if (!notice.contains(event.target as Node)) {
            event.stopImmediatePropagation();
        }
    };
    const keepKeys = (event: KeyboardEvent): void => event.stopPropagation();
    window.addEventListener('keydown', blockKeys, true);
    window.addEventListener('keyup', blockKeys, true);
    notice.addEventListener('keydown', keepKeys);
    notice.addEventListener('keyup', keepKeys);
    close.addEventListener('click', () => {
        window.removeEventListener('keydown', blockKeys, true);
        window.removeEventListener('keyup', blockKeys, true);
        notice.remove();
        closed();
    });

    document.body.append(notice);
    close.focus();
}
