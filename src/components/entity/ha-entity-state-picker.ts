import type { HassEntity } from "home-assistant-js-websocket";
import type { PropertyValues } from "lit";
import { LitElement, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators";
import { fireEvent } from "../../common/dom/fire_event";
import { getStates } from "../../common/entity/get_states";
import type { HomeAssistant, ValueChangedEvent } from "../../types";
import "../ha-combo-box";
import type { HaComboBox } from "../ha-combo-box";

export type HaEntityPickerEntityFilterFunc = (entityId: HassEntity) => boolean;

@customElement("ha-entity-state-picker")
class HaEntityStatePicker extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public entityId?: string;

  @property() public attribute?: string;

  @property({ attribute: false }) public extraOptions?: any[];

  // eslint-disable-next-line lit/no-native-attributes
  @property({ type: Boolean }) public autofocus = false;

  @property({ type: Boolean }) public disabled = false;

  @property({ type: Boolean }) public required = false;

  @property({ type: Boolean, attribute: "allow-custom-value" })
  public allowCustomValue;

  @property() public label?: string;

  @property() public value?: string;

  @property() public helper?: string;

  @state() private _opened = false;

  @query("ha-combo-box", true) private _comboBox!: HaComboBox;

  protected shouldUpdate(changedProps: PropertyValues) {
    return !(!changedProps.has("_opened") && this._opened);
  }

  protected updated(changedProps: PropertyValues) {
    if (
      (changedProps.has("_opened") && this._opened) ||
      changedProps.has("entityId") ||
      changedProps.has("attribute") ||
      changedProps.has("extraOptions")
    ) {
      const stateObj = this.entityId
        ? this.hass.states[this.entityId]
        : undefined;
      (this._comboBox as any).items = [
        ...(this.extraOptions ?? []),
        ...(this.entityId && stateObj
          ? getStates(this.hass, stateObj, this.attribute).map((key) => ({
              value: key,
              label: !this.attribute
                ? this.hass.formatEntityState(stateObj, key)
                : this.hass.formatEntityAttributeValue(
                    stateObj,
                    this.attribute,
                    key
                  ),
            }))
          : []),
      ];
    }
  }

  protected render() {
    if (!this.hass) {
      return nothing;
    }

    return html`
      <ha-combo-box
        .hass=${this.hass}
        .value=${this._value}
        .autofocus=${this.autofocus}
        .label=${this.label ??
        this.hass.localize("ui.components.entity.entity-state-picker.state")}
        .disabled=${this.disabled || !this.entityId}
        .required=${this.required}
        .helper=${this.helper}
        .allowCustomValue=${this.allowCustomValue}
        item-value-path="value"
        item-label-path="label"
        @opened-changed=${this._openedChanged}
        @value-changed=${this._valueChanged}
      >
      </ha-combo-box>
    `;
  }

  private get _value() {
    return this.value || "";
  }

  private _openedChanged(ev: ValueChangedEvent<boolean>) {
    this._opened = ev.detail.value;
  }

  private _valueChanged(ev: ValueChangedEvent<string>) {
    ev.stopPropagation();
    const newValue = ev.detail.value;
    if (newValue !== this._value) {
      this._setValue(newValue);
    }
  }

  private _setValue(value: string) {
    this.value = value;
    setTimeout(() => {
      fireEvent(this, "value-changed", { value });
      fireEvent(this, "change");
    }, 0);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-entity-state-picker": HaEntityStatePicker;
  }
}
