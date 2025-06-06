import type { LovelaceSectionConfig } from "../../../data/lovelace/config/section";
import type { LovelaceStrategyConfig } from "../../../data/lovelace/config/strategy";
import type { LovelaceConfig } from "../../../data/lovelace/config/types";
import type { LovelaceViewConfig } from "../../../data/lovelace/config/view";
import type { HomeAssistant } from "../../../types";
import type { LovelaceGenericElementEditor } from "../types";

export interface LovelaceStrategy<T = any> {
  generate(config: LovelaceStrategyConfig, hass: HomeAssistant): Promise<T>;
  getConfigElement?: () => LovelaceStrategyEditor;
  noEditor?: boolean;
  configRequired?: boolean;
}

export interface LovelaceDashboardStrategy
  extends LovelaceStrategy<LovelaceConfig> {}

export interface LovelaceViewStrategy
  extends LovelaceStrategy<LovelaceViewConfig> {}

export interface LovelaceSectionStrategy
  extends LovelaceStrategy<LovelaceSectionConfig> {}

export interface LovelaceStrategyEditor extends LovelaceGenericElementEditor {
  setConfig(config: LovelaceStrategyConfig): void;
}
