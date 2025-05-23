import { mdiClose, mdiHelpCircle } from "@mdi/js";
import type { UnsubscribeFunc } from "home-assistant-js-websocket";
import type { CSSResultGroup, PropertyValues } from "lit";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import type { HASSDomEvent } from "../../common/dom/fire_event";
import { fireEvent } from "../../common/dom/fire_event";
import "../../components/ha-dialog";
import "../../components/ha-icon-button";
import type { DataEntryFlowStep } from "../../data/data_entry_flow";
import {
  subscribeDataEntryFlowProgress,
  subscribeDataEntryFlowProgressed,
} from "../../data/data_entry_flow";
import { haStyleDialog } from "../../resources/styles";
import type { HomeAssistant } from "../../types";
import { documentationUrl } from "../../util/documentation-url";
import { showAlertDialog } from "../generic/show-dialog-box";
import type {
  DataEntryFlowDialogParams,
  LoadingReason,
} from "./show-dialog-data-entry-flow";
import "./step-flow-abort";
import "./step-flow-create-entry";
import "./step-flow-external";
import "./step-flow-form";
import "./step-flow-loading";
import "./step-flow-menu";
import "./step-flow-progress";

let instance = 0;

interface FlowUpdateEvent {
  step?: DataEntryFlowStep;
  stepPromise?: Promise<DataEntryFlowStep>;
}

declare global {
  // for fire event
  interface HASSDomEvents {
    "flow-update": FlowUpdateEvent;
  }
  // for add event listener
  interface HTMLElementEventMap {
    "flow-update": HASSDomEvent<FlowUpdateEvent>;
  }
}

@customElement("dialog-data-entry-flow")
class DataEntryFlowDialog extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _params?: DataEntryFlowDialogParams;

  @state() private _loading?: LoadingReason;

  @state() private _progress?: number;

  private _instance = instance;

  @state() private _step:
    | DataEntryFlowStep
    | undefined
    // Null means we need to pick a config flow
    | null;

  @state() private _handler?: string;

  private _unsubDataEntryFlowProgress?: UnsubscribeFunc;

  public async showDialog(params: DataEntryFlowDialogParams): Promise<void> {
    this._params = params;
    this._instance = instance++;

    const curInstance = this._instance;
    let step: DataEntryFlowStep;

    if (params.startFlowHandler) {
      this._loading = "loading_flow";
      this._handler = params.startFlowHandler;
      try {
        step = await this._params!.flowConfig.createFlow(
          this.hass,
          params.startFlowHandler
        );
      } catch (err: any) {
        this.closeDialog();
        let message = err.message || err.body || "Unknown error";
        if (typeof message !== "string") {
          message = JSON.stringify(message);
        }
        showAlertDialog(this, {
          title: this.hass.localize(
            "ui.panel.config.integrations.config_flow.error"
          ),
          text: `${this.hass.localize(
            "ui.panel.config.integrations.config_flow.could_not_load"
          )}: ${message}`,
        });
        return;
      }
      // Happens if second showDialog called
      if (curInstance !== this._instance) {
        return;
      }
    } else if (params.continueFlowId) {
      this._loading = "loading_flow";
      try {
        step = await params.flowConfig.fetchFlow(
          this.hass,
          params.continueFlowId
        );
      } catch (err: any) {
        this.closeDialog();
        let message = err.message || err.body || "Unknown error";
        if (typeof message !== "string") {
          message = JSON.stringify(message);
        }
        showAlertDialog(this, {
          title: this.hass.localize(
            "ui.panel.config.integrations.config_flow.error"
          ),
          text: `${this.hass.localize(
            "ui.panel.config.integrations.config_flow.could_not_load"
          )}: ${message}`,
        });
        return;
      }
    } else {
      return;
    }

    // Happens if second showDialog called
    if (curInstance !== this._instance) {
      return;
    }

    this._processStep(step);
    this._loading = undefined;
  }

  public closeDialog() {
    if (!this._params) {
      return;
    }
    const flowFinished = Boolean(
      this._step && ["create_entry", "abort"].includes(this._step.type)
    );

    // If we created this flow, delete it now.
    if (this._step && !flowFinished && !this._params.continueFlowId) {
      this._params.flowConfig.deleteFlow(this.hass, this._step.flow_id);
    }

    if (this._step && this._params.dialogClosedCallback) {
      this._params.dialogClosedCallback({
        flowFinished,
        entryId:
          "result" in this._step ? this._step.result?.entry_id : undefined,
      });
    }

    this._loading = undefined;
    this._step = undefined;
    this._params = undefined;
    this._handler = undefined;
    if (this._unsubDataEntryFlowProgress) {
      this._unsubDataEntryFlowProgress();
      this._unsubDataEntryFlowProgress = undefined;
    }
    fireEvent(this, "dialog-closed", { dialog: this.localName });
  }

  protected render() {
    if (!this._params) {
      return nothing;
    }

    const showDocumentationLink =
      ([
        "form",
        "menu",
        "external",
        "progress",
        "data_entry_flow_progressed",
      ].includes(this._step?.type as any) &&
        this._params.manifest?.is_built_in) ||
      !!this._params.manifest?.documentation;

    return html`
      <ha-dialog
        open
        @closed=${this.closeDialog}
        scrimClickAction
        escapeKeyAction
        hideActions
      >
        <div>
          ${this._loading || this._step === null
            ? html`
                <step-flow-loading
                  .flowConfig=${this._params.flowConfig}
                  .hass=${this.hass}
                  .loadingReason=${this._loading!}
                  .handler=${this._handler}
                  .step=${this._step}
                ></step-flow-loading>
              `
            : this._step === undefined
              ? // When we are going to next step, we render 1 round of empty
                // to reset the element.
                nothing
              : html`
                  <div class="dialog-actions">
                    ${showDocumentationLink
                      ? html`
                          <a
                            href=${this._params.manifest!.is_built_in
                              ? documentationUrl(
                                  this.hass,
                                  `/integrations/${this._params.manifest!.domain}`
                                )
                              : this._params.manifest!.documentation}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            <ha-icon-button
                              .label=${this.hass.localize("ui.common.help")}
                              .path=${mdiHelpCircle}
                            >
                            </ha-icon-button
                          ></a>
                        `
                      : nothing}
                    <ha-icon-button
                      .label=${this.hass.localize("ui.common.close")}
                      .path=${mdiClose}
                      dialogAction="close"
                    ></ha-icon-button>
                  </div>
                  ${this._step.type === "form"
                    ? html`
                        <step-flow-form
                          .flowConfig=${this._params.flowConfig}
                          .step=${this._step}
                          .hass=${this.hass}
                          .increasePaddingEnd=${showDocumentationLink}
                        ></step-flow-form>
                      `
                    : this._step.type === "external"
                      ? html`
                          <step-flow-external
                            .flowConfig=${this._params.flowConfig}
                            .step=${this._step}
                            .hass=${this.hass}
                            .increasePaddingEnd=${showDocumentationLink}
                          ></step-flow-external>
                        `
                      : this._step.type === "abort"
                        ? html`
                            <step-flow-abort
                              .params=${this._params}
                              .step=${this._step}
                              .hass=${this.hass}
                              .handler=${this._step.handler}
                              .domain=${this._params.domain ??
                              this._step.handler}
                              .increasePaddingEnd=${showDocumentationLink}
                            ></step-flow-abort>
                          `
                        : this._step.type === "progress"
                          ? html`
                              <step-flow-progress
                                .flowConfig=${this._params.flowConfig}
                                .step=${this._step}
                                .hass=${this.hass}
                                .progress=${this._progress}
                                .increasePaddingEnd=${showDocumentationLink}
                              ></step-flow-progress>
                            `
                          : this._step.type === "menu"
                            ? html`
                                <step-flow-menu
                                  .flowConfig=${this._params.flowConfig}
                                  .step=${this._step}
                                  .hass=${this.hass}
                                  .increasePaddingEnd=${showDocumentationLink}
                                ></step-flow-menu>
                              `
                            : html`
                                <step-flow-create-entry
                                  .flowConfig=${this._params.flowConfig}
                                  .step=${this._step}
                                  .hass=${this.hass}
                                  .navigateToResult=${this._params
                                    .navigateToResult ?? false}
                                  .increasePaddingEnd=${showDocumentationLink}
                                ></step-flow-create-entry>
                              `}
                `}
        </div>
      </ha-dialog>
    `;
  }

  protected firstUpdated(changedProps: PropertyValues) {
    super.firstUpdated(changedProps);
    this.addEventListener("flow-update", (ev) => {
      const { step, stepPromise } = ev.detail;
      this._processStep(step || stepPromise);
    });
  }

  public willUpdate(changedProps: PropertyValues) {
    super.willUpdate(changedProps);
    if (!changedProps.has("_step") || !this._step) {
      return;
    }
    if (["external", "progress"].includes(this._step.type)) {
      // external and progress step will send update event from the backend, so we should subscribe to them
      this._subscribeDataEntryFlowProgressed();
    }
  }

  private async _processStep(
    step: DataEntryFlowStep | undefined | Promise<DataEntryFlowStep>
  ): Promise<void> {
    if (step === undefined) {
      this.closeDialog();
      return;
    }

    this._loading = "loading_step";
    let _step: DataEntryFlowStep;
    try {
      _step = await step;
    } catch (err: any) {
      this.closeDialog();
      showAlertDialog(this, {
        title: this.hass.localize(
          "ui.panel.config.integrations.config_flow.error"
        ),
        text: err?.body?.message,
      });
      return;
    } finally {
      this._loading = undefined;
    }

    this._step = undefined;
    await this.updateComplete;
    this._step = _step;
  }

  private async _subscribeDataEntryFlowProgressed() {
    if (this._unsubDataEntryFlowProgress) {
      return;
    }
    this._progress = undefined;
    const unsubs = [
      subscribeDataEntryFlowProgressed(this.hass.connection, (ev) => {
        if (ev.data.flow_id !== this._step?.flow_id) {
          return;
        }
        this._processStep(
          this._params!.flowConfig.fetchFlow(this.hass, this._step.flow_id)
        );
        this._progress = undefined;
      }),
      subscribeDataEntryFlowProgress(this.hass.connection, (ev) => {
        // ha-progress-ring has an issue with 0 so we round up
        this._progress = Math.ceil(ev.data.progress * 100);
      }),
    ];
    this._unsubDataEntryFlowProgress = async () => {
      (await Promise.all(unsubs)).map((unsub) => unsub());
    };
  }

  static get styles(): CSSResultGroup {
    return [
      haStyleDialog,
      css`
        ha-dialog {
          --dialog-content-padding: 0;
        }
        .dialog-actions {
          padding: 16px;
          position: absolute;
          top: 0;
          right: 0;
          inset-inline-start: initial;
          inset-inline-end: 0px;
          direction: var(--direction);
        }
        .dialog-actions > * {
          color: var(--secondary-text-color);
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "dialog-data-entry-flow": DataEntryFlowDialog;
  }
}
