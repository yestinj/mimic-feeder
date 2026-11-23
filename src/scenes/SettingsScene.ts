import * as Phaser from 'phaser';
import { isMuted, playSound, setMuted } from '../audio';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { eraseProfile, onProfileChange, profile, systemPrefersReducedMotion, updateProfile } from '../profile';
import { DEFAULT_NAME, NAME_CHARACTER, NAME_MAX_LENGTH, defaultSettings, nameMimic, type Settings } from '../rules/save';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Menu, type Focusable } from '../ui/Menu';
import { ActionRow, SliderRow, TextRow, ToggleRow } from '../ui/Row';
import { TEXT_FIELD_EVENTS } from '../ui/TextField';
import { addPanel } from '../ui/kit';
import { onKeyDown } from '../ui/keys';
import { closeScreen, startScreen, type ScreenData } from '../ui/screens';
import { addText } from '../ui/text';
import { showToast } from '../ui/toast';

const PANEL_WIDTH = 820;
const PANEL_HEIGHT = 600;
const PANEL_Y = 520;
const LEFT_X = DESIGN_WIDTH / 2 - 440;
const RIGHT_X = DESIGN_WIDTH / 2 + 440;
const ROW_WIDTH = PANEL_WIDTH - 2 * SPACE.l;
const PANEL_TOP = PANEL_Y - PANEL_HEIGHT / 2;


/**
 * Settings, from the title or pause menu: audio, display, the mimic's name,
 * and resetting or erasing the save. Every change saves straight away.
 */
export class SettingsScene extends Phaser.Scene {
    private screen!: ScreenData;
    private menu!: Menu;
    private dialog: ConfirmDialog | null = null;
    private leaving = false;
    private music!: SliderRow;
    private effects!: SliderRow;
    private mute!: ToggleRow;
    private fullscreen!: ToggleRow;
    private shake!: ToggleRow;
    private motion!: ToggleRow;
    private countdown!: ToggleRow;
    private nameRow!: TextRow;
    private hint!: Phaser.GameObjects.Text;

    constructor() {
        super('settings');
    }

    create(data: ScreenData): void {
        this.screen = data;
        this.dialog = null;
        this.leaving = false;
        startScreen(this, data);
        addText(this, DESIGN_WIDTH / 2, 110, STRINGS.settings.title, TYPE.title, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);

        addPanel(this, LEFT_X, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT);
        addPanel(this, RIGHT_X, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT);
        const items = [...this.addAudioAndDisplay(), ...this.addProfileAndData()];
        const back = new Button(this, DESIGN_WIDTH / 2, 900, STRINGS.settings.back, { width: 360, quiet: true, onSelect: () => this.close() });
        this.menu = new Menu(this, [...items, back]);

        this.hint = addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT - 70, STRINGS.settings.hint, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        this.nameRow.field.on(TEXT_FIELD_EVENTS.editing, (editing: boolean) => {
            this.hint.setText(editing ? STRINGS.settings.typingHint : STRINGS.settings.hint);
        });

        onKeyDown(this, ['ESC'], () => this.back());
        // A click anywhere else while typing a name saves it, as leaving a text box does.
        const saveNameOnClickElsewhere = (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void => {
            if (this.nameRow.capturing && !over.includes(this.nameRow)) {
                this.nameRow.select();
            }
        };
        this.input.on(Phaser.Input.Events.POINTER_DOWN, saveNameOnClickElsewhere);
        // M and F work everywhere; keep the switches in step.
        const stopFollowingMute = onProfileChange((save) => this.mute.setValue(save.settings.muted));
        const onFullscreen = (): void => this.fullscreen.setValue(this.scale.isFullscreen);
        // The browser can refuse fullscreen; the switch then goes back to Off.
        const fullscreenEvents = [
            Phaser.Scale.Events.ENTER_FULLSCREEN,
            Phaser.Scale.Events.LEAVE_FULLSCREEN,
            Phaser.Scale.Events.FULLSCREEN_FAILED,
            Phaser.Scale.Events.FULLSCREEN_UNSUPPORTED,
        ];
        fullscreenEvents.forEach((event) => this.scale.on(event, onFullscreen));
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            stopFollowingMute();
            this.input.off(Phaser.Input.Events.POINTER_DOWN, saveNameOnClickElsewhere);
            fullscreenEvents.forEach((event) => this.scale.off(event, onFullscreen));
        });

        this.cameras.main.fadeIn(MOTION.fast, 0, 0, 0);
        markReady('settings');
    }

    private addHeading(x: number, y: number, text: string): void {
        addText(this, x - ROW_WIDTH / 2 + 20, y, text.toUpperCase(), TYPE.tiny, { bold: true, colour: TEXT_COLOURS.muted, letterSpacing: 4 }).setOrigin(0, 0.5);
    }

    private addAudioAndDisplay(): Focusable[] {
        const settings = profile().settings;
        const s = STRINGS.settings;
        const onOff = { on: s.on, off: s.off };
        this.addHeading(LEFT_X, PANEL_TOP + 48, s.audio);
        this.music = new SliderRow(this, LEFT_X, PANEL_TOP + 110, ROW_WIDTH, s.musicVolume, settings.musicVolume, (value) => this.changeSettings({ musicVolume: value }));
        this.effects = new SliderRow(this, LEFT_X, PANEL_TOP + 176, ROW_WIDTH, s.effectsVolume, settings.effectsVolume, (value) => {
            this.changeSettings({ effectsVolume: value });
            playSound(this, 'collect');
        });
        this.mute = new ToggleRow(this, LEFT_X, PANEL_TOP + 242, ROW_WIDTH, s.mute, isMuted(), onOff, (muted) => setMuted(this.game, muted));

        this.addHeading(LEFT_X, PANEL_TOP + 318, s.display);
        this.fullscreen = new ToggleRow(this, LEFT_X, PANEL_TOP + 380, ROW_WIDTH, s.fullscreen, this.scale.isFullscreen, onOff, (on) => {
            if (on) {
                this.scale.startFullscreen();
            } else {
                this.scale.stopFullscreen();
            }
        });
        this.shake = new ToggleRow(this, LEFT_X, PANEL_TOP + 446, ROW_WIDTH, s.screenShake, settings.screenShake, onOff, (on) => this.changeSettings({ screenShake: on }));
        this.motion = new ToggleRow(this, LEFT_X, PANEL_TOP + 512, ROW_WIDTH, s.reducedMotion, settings.reducedMotion, onOff, (on) => this.changeSettings({ reducedMotion: on }));
        return [this.music, this.effects, this.mute, this.fullscreen, this.shake, this.motion];
    }

    private addProfileAndData(): Focusable[] {
        const s = STRINGS.settings;
        this.addHeading(RIGHT_X, PANEL_TOP + 48, s.profile);
        this.nameRow = new TextRow(this, RIGHT_X, PANEL_TOP + 110, ROW_WIDTH, s.name, profile().named ? profile().name : '', {
            maxLength: NAME_MAX_LENGTH,
            placeholder: DEFAULT_NAME,
            allowed: NAME_CHARACTER,
        }, (value) => {
            const saved = updateProfile((save) => nameMimic(save, value));
            this.nameRow.field.setValue(saved.name);
            this.notify(s.nameSaved(saved.name));
        });

        this.addHeading(RIGHT_X, PANEL_TOP + 186, s.data);
        const reset = new ActionRow(this, RIGHT_X, PANEL_TOP + 248, ROW_WIDTH, s.resetSettings, () => {
            updateProfile((save) => ({ ...save, settings: defaultSettings(systemPrefersReducedMotion()) }));
            this.applySaved();
            this.notify(s.settingsReset);
        });
        const erase = new ActionRow(this, RIGHT_X, PANEL_TOP + 314, ROW_WIDTH, s.eraseSave, () => this.confirmErase(erase), { danger: true });

        this.addHeading(RIGHT_X, PANEL_TOP + 390, s.play);
        const onOff = { on: s.on, off: s.off };
        this.countdown = new ToggleRow(this, RIGHT_X, PANEL_TOP + 452, ROW_WIDTH, s.resumeCountdown, profile().settings.resumeCountdown, onOff, (on) => this.changeSettings({ resumeCountdown: on }));
        addText(this, RIGHT_X, PANEL_TOP + PANEL_HEIGHT - 40, s.autosave, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        return [this.nameRow, reset, erase, this.countdown];
    }

    /** Confirmations appear in the space under the Play row, clear of the Back button. */
    private notify(message: string): void {
        showToast(this, message, { x: RIGHT_X, y: PANEL_TOP + 516 });
    }

    private changeSettings(change: Partial<Settings>): void {
        updateProfile((save) => ({ ...save, settings: { ...save.settings, ...change } }));
    }

    /** After a reset or erase: apply the saved mute and show the saved values. */
    private applySaved(): void {
        const save = profile();
        setMuted(this.game, save.settings.muted);
        this.music.setValue(save.settings.musicVolume);
        this.effects.setValue(save.settings.effectsVolume);
        this.shake.setValue(save.settings.screenShake);
        this.motion.setValue(save.settings.reducedMotion);
        this.countdown.setValue(save.settings.resumeCountdown);
        this.nameRow.field.setValue(save.named ? save.name : '');
    }

    private confirmErase(row: Focusable): void {
        this.menu.setEnabled(false);
        this.dialog = new ConfirmDialog(this, {
            message: STRINGS.confirm.erase,
            detail: STRINGS.confirm.eraseDetail,
            cancelLabel: STRINGS.confirm.cancel,
            confirmLabel: STRINGS.confirm.eraseConfirm,
            danger: true,
            onConfirm: () => {
                eraseProfile();
                this.applySaved();
                this.closeDialog(row);
                this.notify(STRINGS.settings.erased);
            },
            onCancel: () => this.closeDialog(row),
        });
    }

    private closeDialog(row: Focusable): void {
        this.dialog = null;
        this.menu.setEnabled(true);
        this.menu.focusItem(row);
    }

    /** Esc: closes the dialog, or stops typing, or leaves. */
    private back(): void {
        if (this.dialog) {
            this.dialog.cancel();
        } else if (this.nameRow.capturing) {
            this.nameRow.cancel();
        } else {
            this.close();
        }
    }

    private close(): void {
        if (this.leaving) {
            return;
        }
        this.leaving = true;
        this.menu.setEnabled(false);
        closeScreen(this, this.screen);
    }
}
