import {
  mdiCheck,
  mdiCheckCircleOutline,
  mdiDotsVertical,
  mdiOpenInNew,
  mdiPlus,
} from "@mdi/js";
import type { PropertyValues } from "lit";
import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { ifDefined } from "lit/directives/if-defined";
import memoize from "memoize-one";
import { isComponentLoaded } from "../../../../common/config/is_component_loaded";
import { storage } from "../../../../common/decorators/storage";
import { navigate } from "../../../../common/navigate";
import { stringCompare } from "../../../../common/string/compare";
import type { LocalizeFunc } from "../../../../common/translations/localize";
import type {
  DataTableColumnContainer,
  RowClickedEvent,
  SortingChangedEvent,
} from "../../../../components/data-table/ha-data-table";
import "../../../../components/ha-fab";
import "../../../../components/ha-icon";
import "../../../../components/ha-icon-button";
import "../../../../components/ha-md-button-menu";
import "../../../../components/ha-md-list-item";
import "../../../../components/ha-svg-icon";
import "../../../../components/ha-tooltip";
import type { LovelacePanelConfig } from "../../../../data/lovelace";
import type { LovelaceRawConfig } from "../../../../data/lovelace/config/types";
import {
  isStrategyDashboard,
  saveConfig,
} from "../../../../data/lovelace/config/types";
import type {
  LovelaceDashboard,
  LovelaceDashboardCreateParams,
} from "../../../../data/lovelace/dashboard";
import {
  createDashboard,
  deleteDashboard,
  fetchDashboards,
  updateDashboard,
} from "../../../../data/lovelace/dashboard";
import { showConfirmationDialog } from "../../../../dialogs/generic/show-dialog-box";
import "../../../../layouts/hass-loading-screen";
import "../../../../layouts/hass-tabs-subpage-data-table";
import type { HomeAssistant, Route } from "../../../../types";
import { getLovelaceStrategy } from "../../../lovelace/strategies/get-strategy";
import { showNewDashboardDialog } from "../../dashboard/show-dialog-new-dashboard";
import { lovelaceTabs } from "../ha-config-lovelace";
import { showDashboardConfigureStrategyDialog } from "./show-dialog-lovelace-dashboard-configure-strategy";
import { showDashboardDetailDialog } from "./show-dialog-lovelace-dashboard-detail";

type DataTableItem = Pick<
  LovelaceDashboard,
  "icon" | "title" | "show_in_sidebar" | "require_admin" | "mode" | "url_path"
> & {
  default: boolean;
  filename: string;
  iconColor?: string;
};

@customElement("ha-config-lovelace-dashboards")
export class HaConfigLovelaceDashboards extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: "is-wide", type: Boolean }) public isWide = false;

  @property({ type: Boolean }) public narrow = false;

  @property({ attribute: false }) public route!: Route;

  @state() private _dashboards: LovelaceDashboard[] = [];

  @state()
  @storage({
    storage: "sessionStorage",
    key: "lovelace-dashboards-table-search",
    state: true,
    subscribe: false,
  })
  private _filter = "";

  @storage({
    key: "lovelace-dashboards-table-sort",
    state: false,
    subscribe: false,
  })
  private _activeSorting?: SortingChangedEvent;

  @storage({
    key: "lovelace-dashboards-table-column-order",
    state: false,
    subscribe: false,
  })
  private _activeColumnOrder?: string[];

  @storage({
    key: "lovelace-dashboards-table-hidden-columns",
    state: false,
    subscribe: false,
  })
  private _activeHiddenColumns?: string[];

  public willUpdate() {
    if (!this.hasUpdated) {
      this.hass.loadFragmentTranslation("lovelace");
    }
  }

  private _columns = memoize(
    (
      narrow: boolean,
      _language,
      dashboards,
      localize: LocalizeFunc
    ): DataTableColumnContainer => {
      const columns: DataTableColumnContainer<DataTableItem> = {
        icon: {
          title: "",
          moveable: false,
          showNarrow: true,
          label: localize(
            "ui.panel.config.lovelace.dashboards.picker.headers.icon"
          ),
          type: "icon",
          template: (dashboard) =>
            dashboard.icon
              ? html`
                  <ha-icon
                    slot="item-icon"
                    .icon=${dashboard.icon}
                    style=${ifDefined(
                      dashboard.iconColor
                        ? `color: ${dashboard.iconColor}`
                        : undefined
                    )}
                  ></ha-icon>
                `
              : nothing,
        },
        title: {
          title: localize(
            "ui.panel.config.lovelace.dashboards.picker.headers.title"
          ),
          main: true,
          sortable: true,
          filterable: true,
          flex: 2,
          template: narrow
            ? undefined
            : (dashboard) => html`
                ${dashboard.title}
                ${dashboard.default
                  ? html`
                      <ha-tooltip
                        .content=${this.hass.localize(
                          `ui.panel.config.lovelace.dashboards.default_dashboard`
                        )}
                        placement="right"
                      >
                        <ha-svg-icon
                          style="padding-left: 10px; padding-inline-start: 10px; padding-inline-end: initial; direction: var(--direction);"
                          .path=${mdiCheckCircleOutline}
                        ></ha-svg-icon>
                      </ha-tooltip>
                    `
                  : nothing}
              `,
        },
      };

      columns.mode = {
        title: localize(
          "ui.panel.config.lovelace.dashboards.picker.headers.conf_mode"
        ),
        sortable: true,
        filterable: true,
        template: (dashboard) => html`
          ${this.hass.localize(
            `ui.panel.config.lovelace.dashboards.conf_mode.${dashboard.mode}`
          ) || dashboard.mode}
        `,
      };
      if (dashboards.some((dashboard) => dashboard.filename)) {
        columns.filename = {
          title: localize(
            "ui.panel.config.lovelace.dashboards.picker.headers.filename"
          ),
          sortable: true,
          filterable: true,
        };
      }
      columns.require_admin = {
        title: localize(
          "ui.panel.config.lovelace.dashboards.picker.headers.require_admin"
        ),
        sortable: true,
        type: "icon",
        hidden: narrow,
        template: (dashboard) =>
          dashboard.require_admin
            ? html`<ha-svg-icon .path=${mdiCheck}></ha-svg-icon>`
            : html`—`,
      };
      columns.show_in_sidebar = {
        title: localize(
          "ui.panel.config.lovelace.dashboards.picker.headers.sidebar"
        ),
        type: "icon",
        hidden: narrow,
        template: (dashboard) =>
          dashboard.show_in_sidebar
            ? html`<ha-svg-icon .path=${mdiCheck}></ha-svg-icon>`
            : html`—`,
      };

      columns.url_path = {
        title: "",
        label: localize(
          "ui.panel.config.lovelace.dashboards.picker.headers.url"
        ),
        filterable: true,
        showNarrow: true,
        template: (dashboard) =>
          narrow
            ? html`
                <ha-icon-button
                  .path=${mdiOpenInNew}
                  .urlPath=${dashboard.url_path}
                  @click=${this._navigate}
                  .label=${this.hass.localize(
                    "ui.panel.config.lovelace.dashboards.picker.open"
                  )}
                ></ha-icon-button>
              `
            : html`
                <mwc-button
                  .urlPath=${dashboard.url_path}
                  @click=${this._navigate}
                  >${this.hass.localize(
                    "ui.panel.config.lovelace.dashboards.picker.open"
                  )}</mwc-button
                >
              `,
      };

      return columns;
    }
  );

  private _getItems = memoize((dashboards: LovelaceDashboard[]) => {
    const defaultMode = (
      this.hass.panels?.lovelace?.config as LovelacePanelConfig
    ).mode;
    const defaultUrlPath = this.hass.defaultPanel;
    const isDefault = defaultUrlPath === "lovelace";
    const result: DataTableItem[] = [
      {
        icon: "hass:view-dashboard",
        title: this.hass.localize("panel.states"),
        default: isDefault,
        show_in_sidebar: isDefault,
        require_admin: false,
        url_path: "lovelace",
        mode: defaultMode,
        filename: defaultMode === "yaml" ? "ui-lovelace.yaml" : "",
        iconColor: "var(--primary-color)",
      },
    ];
    if (isComponentLoaded(this.hass, "energy")) {
      result.push({
        icon: "hass:lightning-bolt",
        title: this.hass.localize(`ui.panel.config.dashboard.energy.main`),
        show_in_sidebar: true,
        mode: "storage",
        url_path: "energy",
        filename: "",
        iconColor: "var(--label-badge-yellow)",
        default: false,
        require_admin: false,
      });
    }

    result.push(
      ...dashboards
        .sort((a, b) =>
          stringCompare(a.title, b.title, this.hass.locale.language)
        )
        .map((dashboard) => ({
          filename: "",
          ...dashboard,
          default: defaultUrlPath === dashboard.url_path,
        }))
    );
    return result;
  });

  protected render() {
    if (!this.hass || this._dashboards === undefined) {
      return html` <hass-loading-screen></hass-loading-screen> `;
    }

    return html`
      <hass-tabs-subpage-data-table
        .hass=${this.hass}
        .narrow=${this.narrow}
        back-path="/config"
        .route=${this.route}
        .tabs=${lovelaceTabs}
        .columns=${this._columns(
          this.narrow,
          this.hass.language,
          this._dashboards,
          this.hass.localize
        )}
        .data=${this._getItems(this._dashboards)}
        .initialSorting=${this._activeSorting}
        .columnOrder=${this._activeColumnOrder}
        .hiddenColumns=${this._activeHiddenColumns}
        @columns-changed=${this._handleColumnsChanged}
        @sorting-changed=${this._handleSortingChanged}
        .filter=${this._filter}
        @search-changed=${this._handleSearchChange}
        @row-click=${this._editDashboard}
        id="url_path"
        has-fab
        clickable
      >
        <ha-md-button-menu slot="toolbar-icon">
          <ha-icon-button
            slot="trigger"
            .label=${this.hass.localize("ui.common.menu")}
            .path=${mdiDotsVertical}
          ></ha-icon-button>
          <ha-md-list-item type="link" href="/config/lovelace/resources">
            ${this.hass.localize("ui.panel.config.lovelace.resources.caption")}
          </ha-md-list-item>
        </ha-md-button-menu>
        <ha-fab
          slot="fab"
          .label=${this.hass.localize(
            "ui.panel.config.lovelace.dashboards.picker.add_dashboard"
          )}
          extended
          @click=${this._addDashboard}
        >
          <ha-svg-icon slot="icon" .path=${mdiPlus}></ha-svg-icon>
        </ha-fab>
      </hass-tabs-subpage-data-table>
    `;
  }

  protected firstUpdated(changedProps: PropertyValues) {
    super.firstUpdated(changedProps);
    this._getDashboards();
  }

  private async _getDashboards() {
    this._dashboards = await fetchDashboards(this.hass);
  }

  private _navigate(ev: Event) {
    ev.stopPropagation();
    navigate(`/${(ev.target as any).urlPath}`);
  }

  private _editDashboard(ev: CustomEvent) {
    const urlPath = (ev.detail as RowClickedEvent).id;

    if (urlPath === "energy") {
      navigate("/config/energy");
      return;
    }
    const dashboard = this._dashboards.find((res) => res.url_path === urlPath);
    this._openDetailDialog(dashboard, urlPath);
  }

  private async _addDashboard() {
    showNewDashboardDialog(this, {
      selectConfig: async (config) => {
        if (config && isStrategyDashboard(config)) {
          const strategyType = config.strategy.type;
          const strategyClass = await getLovelaceStrategy(
            "dashboard",
            strategyType
          );

          if (strategyClass.configRequired) {
            showDashboardConfigureStrategyDialog(this, {
              config: config,
              saveConfig: async (updatedConfig) => {
                this._openDetailDialog(undefined, undefined, updatedConfig);
              },
            });
            return;
          }
        }

        this._openDetailDialog(undefined, undefined, config);
      },
    });
  }

  private async _openDetailDialog(
    dashboard?: LovelaceDashboard,
    urlPath?: string,
    defaultConfig?: LovelaceRawConfig
  ): Promise<void> {
    showDashboardDetailDialog(this, {
      dashboard,
      urlPath,
      createDashboard: async (values: LovelaceDashboardCreateParams) => {
        const created = await createDashboard(this.hass!, values);
        this._dashboards = this._dashboards!.concat(created).sort(
          (res1, res2) =>
            stringCompare(
              res1.url_path,
              res2.url_path,
              this.hass.locale.language
            )
        );
        if (defaultConfig) {
          await saveConfig(this.hass!, created.url_path, defaultConfig);
        }
      },
      updateDashboard: async (values) => {
        const updated = await updateDashboard(
          this.hass!,
          dashboard!.id,
          values
        );
        this._dashboards = this._dashboards!.map((res) =>
          res === dashboard ? updated : res
        );
      },
      removeDashboard: async () => {
        const confirm = await showConfirmationDialog(this, {
          title: this.hass!.localize(
            "ui.panel.config.lovelace.dashboards.confirm_delete_title",
            { dashboard_title: dashboard!.title }
          ),
          text: this.hass!.localize(
            "ui.panel.config.lovelace.dashboards.confirm_delete_text"
          ),
          confirmText: this.hass!.localize("ui.common.delete"),
          destructive: true,
        });
        if (!confirm) {
          return false;
        }
        try {
          await deleteDashboard(this.hass!, dashboard!.id);
          this._dashboards = this._dashboards!.filter(
            (res) => res !== dashboard
          );
          return true;
        } catch (_err: any) {
          return false;
        }
      },
    });
  }

  private _handleSortingChanged(ev: CustomEvent) {
    this._activeSorting = ev.detail;
  }

  private _handleSearchChange(ev: CustomEvent) {
    this._filter = ev.detail.value;
  }

  private _handleColumnsChanged(ev: CustomEvent) {
    this._activeColumnOrder = ev.detail.columnOrder;
    this._activeHiddenColumns = ev.detail.hiddenColumns;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-config-lovelace-dashboards": HaConfigLovelaceDashboards;
  }
}
