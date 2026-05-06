import { useEffect, useRef, useState } from "react";

interface CalendarInputProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
}

interface CalendarCell {
  isoDate: string;
  dayLabel: string;
  isCurrentMonth: boolean;
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const parseIsoDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map((part) => Number(part));

  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value: string): string => {
  const date = parseIsoDate(value);

  if (!date) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
};

const getMonthStart = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, delta: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

const getCalendarCells = (visibleMonth: Date): CalendarCell[] => {
  const monthStart = getMonthStart(visibleMonth);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      isoDate: formatIsoDate(date),
      dayLabel: String(date.getDate()),
      isCurrentMonth: date.getMonth() === visibleMonth.getMonth()
    };
  });
};

export const CalendarInput = ({
  value,
  onChange,
  placeholder = "Select a date"
}: CalendarInputProps): JSX.Element => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = parseIsoDate(value);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() =>
    getMonthStart(selectedDate ?? new Date())
  );

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth(getMonthStart(selectedDate));
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen]);

  const cells = getCalendarCells(visibleMonth);
  const todayIsoDate = formatIsoDate(new Date());

  return (
    <div className="calendar-input" ref={rootRef}>
      <button
        className={`calendar-trigger${value ? "" : " is-placeholder"}`}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {value ? formatDisplayDate(value) : placeholder}
      </button>

      {isOpen ? (
        <div className="calendar-popover">
          <div className="calendar-header">
            <button
              className="ghost-button calendar-nav"
              onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
              type="button"
            >
              Prev
            </button>
            <div className="calendar-header-fields">
              <label className="calendar-select-wrap">
                <span className="sr-only">Month</span>
                <select
                  className="calendar-select"
                  onChange={(event) =>
                    setVisibleMonth(
                      (current) =>
                        new Date(
                          current.getFullYear(),
                          Number(event.target.value),
                          1
                        )
                    )
                  }
                  value={visibleMonth.getMonth()}
                >
                  {MONTH_LABELS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="calendar-year-wrap">
                <span className="sr-only">Year</span>
                <input
                  className="calendar-year-input"
                  inputMode="numeric"
                  max={9999}
                  min={1900}
                  onChange={(event) => {
                    const nextYear = Number(event.target.value);

                    if (Number.isNaN(nextYear)) {
                      return;
                    }

                    setVisibleMonth(
                      (current) => new Date(nextYear, current.getMonth(), 1)
                    );
                  }}
                  type="number"
                  value={visibleMonth.getFullYear()}
                />
              </label>
            </div>
            <button
              className="ghost-button calendar-nav"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              type="button"
            >
              Next
            </button>
          </div>

          <div className="calendar-grid">
            {WEEKDAY_LABELS.map((label) => (
              <span className="calendar-weekday" key={label}>
                {label}
              </span>
            ))}

            {cells.map((cell) => (
              <button
                className={`calendar-day${
                  cell.isCurrentMonth ? "" : " is-muted"
                }${cell.isoDate === todayIsoDate ? " is-today" : ""}${
                  cell.isoDate === value ? " is-selected" : ""
                }`}
                aria-current={cell.isoDate === todayIsoDate ? "date" : undefined}
                disabled={!cell.isCurrentMonth}
                key={cell.isoDate}
                onClick={() => {
                  onChange(cell.isoDate);
                  setIsOpen(false);
                }}
                type="button"
              >
                {cell.dayLabel}
              </button>
            ))}
          </div>

          <div className="calendar-footer">
            <button
              className="ghost-button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
