import { assert, describe, it } from "vitest";

import {
  formatDateTime,
  formatDateTimeWithSeconds,
  formatDateTimeNumeric,
  formatDateTimeWithBrowserDefaults,
} from "../../../src/common/datetime/format_date_time";
import {
  NumberFormat,
  TimeFormat,
  FirstWeekday,
  DateFormat,
  TimeZone,
} from "../../../src/data/translation";
import { demoConfig } from "../../../src/fake_data/demo_config";

describe("formatDateTime", () => {
  const dateObj = new Date(2017, 10, 18, 23, 12, 13, 400);

  it("Formats English date times", () => {
    assert.strictEqual(
      formatDateTime(
        dateObj,
        {
          language: "en",
          number_format: NumberFormat.language,
          time_format: TimeFormat.am_pm,
          date_format: DateFormat.language,
          time_zone: TimeZone.local,
          first_weekday: FirstWeekday.language,
        },
        demoConfig
      ),
      "November 18, 2017 at 11:12 PM"
    );
    assert.strictEqual(
      formatDateTime(
        dateObj,
        {
          language: "en",
          number_format: NumberFormat.language,
          time_format: TimeFormat.twenty_four,
          date_format: DateFormat.language,
          time_zone: TimeZone.local,
          first_weekday: FirstWeekday.language,
        },
        demoConfig
      ),
      "November 18, 2017 at 23:12"
    );
  });

  it("Formats date times without optional params", () => {
    assert.strictEqual(
      formatDateTimeWithBrowserDefaults(dateObj),
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(dateObj)
    );
  });
});

describe("formatDateTimeWithSeconds", () => {
  const dateObj = new Date(2017, 10, 18, 23, 12, 13, 400);

  it("Formats English date times with seconds", () => {
    assert.strictEqual(
      formatDateTimeWithSeconds(
        dateObj,
        {
          language: "en",
          number_format: NumberFormat.language,
          time_format: TimeFormat.am_pm,
          date_format: DateFormat.language,
          time_zone: TimeZone.local,
          first_weekday: FirstWeekday.language,
        },
        demoConfig
      ),
      "November 18, 2017 at 11:12:13 PM"
    );
    assert.strictEqual(
      formatDateTimeWithSeconds(
        dateObj,
        {
          language: "en",
          number_format: NumberFormat.language,
          time_format: TimeFormat.twenty_four,
          date_format: DateFormat.language,
          time_zone: TimeZone.local,

          first_weekday: FirstWeekday.language,
        },
        demoConfig
      ),
      "November 18, 2017 at 23:12:13"
    );
  });
});

describe("formatDateTimeNumeric", () => {
  const dateObj = new Date(2017, 10, 18, 23, 12, 13, 400);

  it("Formats English numeric date times", () => {
    assert.strictEqual(
      formatDateTimeNumeric(
        dateObj,
        {
          language: "en",
          number_format: NumberFormat.language,
          time_format: TimeFormat.am_pm,
          date_format: DateFormat.language,
          time_zone: TimeZone.local,
          first_weekday: FirstWeekday.language,
        },
        demoConfig
      ),
      "11/18/2017, 11:12 PM"
    );
    assert.strictEqual(
      formatDateTimeNumeric(
        dateObj,
        {
          language: "en",
          number_format: NumberFormat.language,
          time_format: TimeFormat.twenty_four,
          date_format: DateFormat.language,
          time_zone: TimeZone.local,
          first_weekday: FirstWeekday.language,
        },
        demoConfig
      ),
      "11/18/2017, 23:12"
    );
  });
});
