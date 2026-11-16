// A plain HTML notice in place of the game, for when it can't start at all.
// It doesn't use Phaser, so it can't fail the way the game did. The page's
// own "needs JavaScript" notice (index.html) has the same look (style.css).

/** Shows a heading and a line of text where the game would be. */
export function showNotice(title: string, text: string): void {
    const notice = document.createElement('div');
    notice.className = 'notice';
    notice.setAttribute('role', 'alert');
    const heading = document.createElement('h1');
    heading.textContent = title;
    const body = document.createElement('p');
    body.textContent = text;
    notice.append(heading, body);
    // Anything Phaser managed to add before it gave up goes.
    (document.getElementById('game') ?? document.body).replaceChildren(notice);
}
