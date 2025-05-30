import type {
  Circle,
  DivIcon,
  DragEndEvent,
  LatLng,
  LatLngExpression,
  Marker,
  MarkerOptions,
} from "leaflet";
import type { PropertyValues, TemplateResult } from "lit";
import { css, html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators";
import memoizeOne from "memoize-one";
import { fireEvent } from "../../common/dom/fire_event";
import type { LeafletModuleType } from "../../common/dom/setup-leaflet-map";
import type { HomeAssistant, ThemeMode } from "../../types";
import "../ha-input-helper-text";
import "./ha-map";
import type { HaMap } from "./ha-map";
import type { HaIcon } from "../ha-icon";
import type { HaSvgIcon } from "../ha-svg-icon";

declare global {
  // for fire event
  interface HASSDomEvents {
    "location-updated": { id: string; location: [number, number] };
    "markers-updated": undefined;
    "radius-updated": { id: string; radius: number };
    "marker-clicked": { id: string };
  }
}

export interface MarkerLocation {
  latitude: number;
  longitude: number;
  radius?: number;
  name?: string;
  id: string;
  icon?: string;
  iconPath?: string;
  radius_color?: string;
  location_editable?: boolean;
  radius_editable?: boolean;
}

@customElement("ha-locations-editor")
export class HaLocationsEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public locations?: MarkerLocation[];

  @property() public helper?: string;

  @property({ attribute: "auto-fit", type: Boolean }) public autoFit = false;

  @property({ type: Number }) public zoom = 16;

  @property({ attribute: "theme-mode", type: String })
  public themeMode: ThemeMode = "auto";

  @property({ type: Boolean, attribute: "pin-on-click" })
  public pinOnClick = false;

  @state() private _locationMarkers?: Record<string, Marker | Circle>;

  @state() private _circles: Record<string, Circle> = {};

  @query("ha-map", true) private map!: HaMap;

  private Leaflet?: LeafletModuleType;

  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  private _loadPromise: Promise<boolean | undefined | void>;

  constructor() {
    super();

    this._loadPromise = import("leaflet").then((module) =>
      import("leaflet-draw").then(() => {
        this.Leaflet = module.default as LeafletModuleType;
        this._updateMarkers();
        return this.updateComplete.then(() => this.fitMap());
      })
    );
  }

  public fitMap(options?: { zoom?: number; pad?: number }): void {
    this.map.fitMap(options);
  }

  public fitBounds(
    boundingbox: LatLngExpression[],
    options?: { zoom?: number; pad?: number }
  ) {
    this.map.fitBounds(boundingbox, options);
  }

  public async fitMarker(
    id: string,
    options?: { zoom?: number }
  ): Promise<void> {
    if (!this.Leaflet) {
      await this._loadPromise;
    }
    if (!this.map.leafletMap || !this._locationMarkers) {
      return;
    }
    const marker = this._locationMarkers[id];
    if (!marker) {
      return;
    }
    if ("getBounds" in marker) {
      this.map.leafletMap.fitBounds(marker.getBounds());
      (marker as Circle).bringToFront();
    } else {
      const circle = this._circles[id];
      if (circle) {
        this.map.leafletMap.fitBounds(circle.getBounds());
      } else {
        this.map.leafletMap.setView(
          marker.getLatLng(),
          options?.zoom || this.zoom
        );
      }
    }
  }

  protected render(): TemplateResult {
    return html`
      <ha-map
        .hass=${this.hass}
        .layers=${this._getLayers(this._circles, this._locationMarkers)}
        .zoom=${this.zoom}
        .autoFit=${this.autoFit}
        .themeMode=${this.themeMode}
        .clickable=${this.pinOnClick}
        @map-clicked=${this._mapClicked}
      ></ha-map>
      ${this.helper
        ? html`<ha-input-helper-text>${this.helper}</ha-input-helper-text>`
        : ""}
    `;
  }

  private _getLayers = memoizeOne(
    (
      circles: Record<string, Circle>,
      markers?: Record<string, Marker | Circle>
    ): (Marker | Circle)[] => {
      const layers: (Marker | Circle)[] = [];
      Array.prototype.push.apply(layers, Object.values(circles));
      if (markers) {
        Array.prototype.push.apply(layers, Object.values(markers));
      }
      return layers;
    }
  );

  public willUpdate(changedProps: PropertyValues): void {
    super.willUpdate(changedProps);

    // Still loading.
    if (!this.Leaflet) {
      return;
    }

    if (changedProps.has("locations")) {
      this._updateMarkers();
    }
  }

  public updated(changedProps: PropertyValues): void {
    // Still loading.
    if (!this.Leaflet) {
      return;
    }

    if (changedProps.has("locations")) {
      const oldLocations = changedProps.get("locations");
      const movedLocations = this.locations?.filter(
        (loc, idx) =>
          !oldLocations[idx] ||
          ((loc.latitude !== oldLocations[idx].latitude ||
            loc.longitude !== oldLocations[idx].longitude) &&
            this.map.leafletMap?.getBounds().contains({
              lat: oldLocations[idx].latitude,
              lng: oldLocations[idx].longitude,
            }) &&
            !this.map.leafletMap
              ?.getBounds()
              .contains({ lat: loc.latitude, lng: loc.longitude }))
      );
      if (movedLocations?.length === 1) {
        this.map.leafletMap?.panTo({
          lat: movedLocations[0].latitude,
          lng: movedLocations[0].longitude,
        });
      }
    }
  }

  private _normalizeLongitude(longitude: number): number {
    if (Math.abs(longitude) > 180.0) {
      // Normalize longitude if map provides values beyond -180 to +180 degrees.
      return (((longitude % 360.0) + 540.0) % 360.0) - 180.0;
    }
    return longitude;
  }

  private _updateLocation(ev: DragEndEvent) {
    const marker = ev.target;
    const latlng: LatLng = marker.getLatLng();
    const location: [number, number] = [
      latlng.lat,
      this._normalizeLongitude(latlng.lng),
    ];
    fireEvent(
      this,
      "location-updated",
      { id: marker.id, location },
      { bubbles: false }
    );
  }

  private _updateRadius(ev: DragEndEvent) {
    const marker = ev.target;
    const circle = this._locationMarkers![marker.id] as Circle;
    fireEvent(
      this,
      "radius-updated",
      { id: marker.id, radius: circle.getRadius() },
      { bubbles: false }
    );
  }

  private _markerClicked(ev: DragEndEvent) {
    const marker = ev.target;
    fireEvent(this, "marker-clicked", { id: marker.id }, { bubbles: false });
  }

  private _mapClicked(ev) {
    if (this.pinOnClick && this._locationMarkers) {
      const id = Object.keys(this._locationMarkers)[0];
      const location: [number, number] = [
        ev.detail.location[0],
        this._normalizeLongitude(ev.detail.location[1]),
      ];
      fireEvent(this, "location-updated", { id, location }, { bubbles: false });

      // If the normalized longitude wraps around the globe, pan to the new location.
      if (location[1] !== ev.detail.location[1]) {
        this.map.leafletMap?.panTo({ lat: location[0], lng: location[1] });
      }
    }
  }

  private _updateMarkers(): void {
    if (!this.locations || !this.locations.length) {
      this._circles = {};
      this._locationMarkers = undefined;
      return;
    }

    const locationMarkers = {};
    const circles = {};

    const defaultZoneRadiusColor =
      getComputedStyle(this).getPropertyValue("--accent-color");

    this.locations.forEach((location: MarkerLocation) => {
      let icon: DivIcon | undefined;
      if (location.icon || location.iconPath) {
        // create icon
        const el = document.createElement("div");
        el.className = "named-icon";
        if (location.name !== undefined) {
          el.innerText = location.name;
        }
        let iconEl: HaIcon | HaSvgIcon;
        if (location.icon) {
          iconEl = document.createElement("ha-icon");
          iconEl.setAttribute("icon", location.icon);
        } else {
          iconEl = document.createElement("ha-svg-icon");
          iconEl.setAttribute("path", location.iconPath!);
        }
        el.prepend(iconEl);

        icon = this.Leaflet!.divIcon({
          html: el.outerHTML,
          iconSize: [24, 24],
          className: "light",
        });
      }
      if (location.radius) {
        const circle = this.Leaflet!.circle(
          [location.latitude, location.longitude],
          {
            color: location.radius_color || defaultZoneRadiusColor,
            radius: location.radius,
          }
        );
        if (location.radius_editable || location.location_editable) {
          // @ts-ignore
          circle.editing.enable();
          circle.addEventListener("add", () => {
            // @ts-ignore
            const moveMarker = circle.editing._moveMarker;
            // @ts-ignore
            const resizeMarker = circle.editing._resizeMarkers[0];
            if (icon) {
              moveMarker.setIcon(icon);
            }
            resizeMarker.id = moveMarker.id = location.id;
            moveMarker
              .addEventListener(
                "dragend",
                // @ts-ignore
                (ev: DragEndEvent) => this._updateLocation(ev)
              )
              .addEventListener(
                "click",
                // @ts-ignore
                (ev: MouseEvent) => this._markerClicked(ev)
              );
            if (location.radius_editable) {
              resizeMarker.addEventListener(
                "dragend",
                // @ts-ignore
                (ev: DragEndEvent) => this._updateRadius(ev)
              );
            } else {
              resizeMarker.remove();
            }
          });
          locationMarkers[location.id] = circle;
        } else {
          circles[location.id] = circle;
        }
      }
      if (
        !location.radius ||
        (!location.radius_editable && !location.location_editable)
      ) {
        const options: MarkerOptions = {
          title: location.name,
          draggable: location.location_editable,
        };

        if (icon) {
          options.icon = icon;
        }

        const marker = this.Leaflet!.marker(
          [location.latitude, location.longitude],
          options
        )
          .addEventListener("dragend", (ev: DragEndEvent) =>
            this._updateLocation(ev)
          )
          .addEventListener(
            // @ts-ignore
            "click",
            // @ts-ignore
            (ev: MouseEvent) => this._markerClicked(ev)
          );
        (marker as any).id = location.id;

        locationMarkers[location.id] = marker;
      }
    });
    this._circles = circles;
    this._locationMarkers = locationMarkers;
    fireEvent(this, "markers-updated");
  }

  static styles = css`
    ha-map {
      display: block;
      height: 100%;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-locations-editor": HaLocationsEditor;
  }
}
