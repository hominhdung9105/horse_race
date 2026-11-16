import ModalDialog from "../core/ModalDialog";
import LandingPage from "./LandingPage";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  api,
  downloadFile,
  login,
  logout,
  PaginationMeta,
  registerCustomer,
  restoreSession,
  User,
} from "../core/api";
import StatusBadge from "../core/StatusBadge";
import {
  action,
  addCheckpoint,
  assignHorse,
  assignResource,
  assignStaff,
  createDispatchTrip,
  createPlan,
  deleteRow,
  confirmFlightBooking,
  cancelFlightBooking,
  getAssignments,
  getCheckpoints,
  getDispatchCalendar,
  getDispatchOrders,
  searchDispatchOrders,
  getLegs,
  updateLeg,
  saveRouteShape,
  getRouteTemplates,
  createRouteTemplate,
  type RouteTemplate,
  getTrip,
  getTripOrders,
  getReadiness,
  getRoutePlanByTrip,
  getVersions,
  newVersion,
  RecordRow,
  ResourceName,
  RoutePlan,
  RouteVersion,
  saveRow,
  setCountrySupport,
  getRouteCapabilities,
  RouteCapabilities,
  Trip,
  TripOrder,
  DispatchCalendarDay,
  getRows,
  getBookingLocations,
  getCustomerCountry,
  getCustomerCountries,
  CountryReference,
  Location,
  getAllTrips,
  getAllMyTrips,
  getMyTripOrders,
  getTrips,
  getStaffDirectory,
  getStaffRouteCountries,
  saveStaffRouteCountries,
  getStaffOperatingAreas,
  saveStaffOperatingAreas,
  getNearestDrivers,
  StaffAccount,
} from "../features/planning/api";
import {
  OsmRouteMap,
  type RouteWaypoint,
  type RouteShapePoint,
} from "../features/planning/OsmRouteMap";
import {
  approveRequestHorseDocument,
  deleteHorse,
  getHorse,
  getHorses,
  getManagerQueue,
  getProfile,
  getRequests,
  getRequest,
  getBookingLeadTime,
  getNearestReceivingLocation,
  BookingLeadTimeInfo,
  RequestDocumentChecklist,
  getRequestDocumentChecklist,
  getManagerRequestDocumentChecklist,
  HorseAvailability,
  getHorseAvailability,
  Horse,
  RequestSummary,
  TransportRequest,
  reviewRequest,
  saveHorse,
  saveProfile,
  saveRequest,
  submitRequest,
  cancelRequest,
  cancelOrder,
  getOrderPayment,
  createOrderPaymentCheckout,
  CustomerProfile,
  ComplianceDocument,
  DocumentType,
  getDocuments,
  getDocumentTypes,
  getRequestHistory,
  getStaffDisplayNames,
  TransportRequestHistoryEntry,
  uploadDocumentFile,
  reviewDocument,
  ComplianceReadiness,
  ComplianceRouteLeg,
  evaluateCompliance,
  ClearanceCase,
  getAllClearanceCases,
  getClearanceCases,
  createClearanceCase,
  submitClearanceCase,
  reviewClearanceCase,
} from "../features/booking/api";
import OperationsView from "../features/operations/OperationsView";
import OsmPointPicker, {
  type MapPoint,
} from "../features/operations/OsmPointPicker";
import {
  getExecution,
  getEta,
  getHealthLogs,
  getHandoverByTrip,
  getLatestGps,
  getOrderStatus,
  getUnreadNotificationCount,
  type Eta,
  type GpsPoint,
  type Handover,
  type TripExecution,
} from "../features/operations/api";
import DashboardView from "../features/dashboard/DashboardView";
import RouteCapabilitiesView from "../features/planning/RouteCapabilitiesView";
import RegulationRulesView from "../features/compliance/RegulationRulesView";
import "./styles.css";

const allowedRoles = [
  "CUSTOMER",
  "TRANSPORT_SPECIALIST",
  "LOGISTICS_MANAGER",
  "ADMIN",
  "COMPLIANCE_OFFICER",
  "DRIVER",
  "ESCORT",
  "DRIVER_ESCORT",
  "FLEET_ROUTE_COORDINATOR",
];
type FleetField = {
  key: string;
  label: string;
  kind:
    | "text"
    | "number"
    | "boolean"
    | "select"
    | "datetime"
    | "textarea"
    | "generated";
  required?: boolean;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  source?: "countries" | "airlines" | "airports";
  options?: { value: string; label: string }[];
  defaultValue?: string;
};
type FleetResource = {
  key: ResourceName;
  title: string;
  description: string;
  columns: { key: string; label: string }[];
  fields: FleetField[];
};
const vehicleTypes = [
  { value: "TRUCK", label: "Horse transport truck" },
  { value: "TRAILER", label: "Horse trailer" },
  { value: "VAN", label: "Transport van" },
  { value: "OTHER", label: "Other vehicle" },
];
const vehicleStatuses = [
  { value: "AVAILABLE", label: "Available" },
  { value: "IN_USE", label: "In use" },
  { value: "MAINTENANCE", label: "In maintenance" },
  { value: "RETIRED", label: "Retired" },
];
const locationTypes = [
  { value: "STABLE", label: "Stable / horse facility" },
  { value: "AIRPORT", label: "Airport" },
  { value: "BORDER_CROSSING", label: "Border crossing" },
  { value: "QUARANTINE_STATION", label: "Quarantine station" },
  { value: "REST_STOP", label: "Rest stop" },
  { value: "FUEL_STOP", label: "Fuel stop" },
  { value: "CUSTOMER_SITE", label: "Customer pickup / delivery" },
  { value: "HANDOVER_POINT", label: "Handover point" },
];
const fleet: FleetResource[] = [
  {
    key: "vehicles",
    title: "Vehicles",
    description:
      "Transport vehicles used on road legs. The system creates an internal code; plate number is the vehicle registration plate.",
    columns: [
      { key: "vehicleCode", label: "Internal code" },
      { key: "plateNumber", label: "License plate" },
      { key: "vehicleType", label: "Type" },
      { key: "horseCapacity", label: "Horse capacity" },
      { key: "status", label: "Availability" },
    ],
    fields: [
      {
        key: "vehicleCode",
        label: "Internal vehicle code · assigned by the system",
        kind: "generated",
      },
      {
        key: "plateNumber",
        label: "License plate number",
        kind: "text",
        required: true,
        help: "The registration plate shown on the vehicle.",
      },
      {
        key: "vehicleType",
        label: "Vehicle type",
        kind: "select",
        options: vehicleTypes,
        required: true,
        defaultValue: "TRUCK",
      },
      {
        key: "horseCapacity",
        label: "Horse capacity",
        kind: "number",
        min: 1,
        step: 1,
        required: true,
        help: "Maximum number of horses this vehicle can transport.",
      },
      {
        key: "stallCapacity",
        label: "Horse compartments (stalls)",
        kind: "number",
        min: 1,
        step: 1,
        required: true,
        help: "Maximum number of horse enclosures the vehicle can carry. Each assigned enclosure is tracked separately on the trip.",
      },
      {
        key: "temperatureControlled",
        label: "Temperature controlled",
        kind: "boolean",
        defaultValue: "false",
      },
      {
        key: "status",
        label: "Availability status",
        kind: "select",
        options: vehicleStatuses,
        required: true,
        defaultValue: "AVAILABLE",
      },
    ],
  },
  {
    key: "locations",
    title: "Locations",
    description:
      "Pickup, delivery, stable, airport, border, and rest-stop locations used in route plans.",
    columns: [
      { key: "name", label: "Location" },
      { key: "locationType", label: "Purpose" },
      { key: "address", label: "Address" },
      { key: "city", label: "City" },
      { key: "countryId", label: "Country" },
    ],
    fields: [
      {
        key: "locationCode",
        label: "Location code · assigned by the system",
        kind: "generated",
      },
      { key: "name", label: "Location name", kind: "text", required: true },
      {
        key: "locationType",
        label: "Location purpose",
        kind: "select",
        options: locationTypes,
        required: true,
        defaultValue: "CUSTOMER_SITE",
      },
      {
        key: "address",
        label: "Street address",
        kind: "text",
        help: "Use the full street address so the pickup or delivery site is recognizable.",
      },
      { key: "city", label: "City / town", kind: "text" },
      {
        key: "countryId",
        label: "Country",
        kind: "select",
        source: "countries",
        required: true,
      },
      {
        key: "latitude",
        label: "Latitude",
        kind: "number",
        min: -90,
        max: 90,
        help: "Decimal degrees, between -90 and 90.",
      },
      {
        key: "longitude",
        label: "Longitude",
        kind: "number",
        min: -180,
        max: 180,
        help: "Decimal degrees, between -180 and 180.",
      },
      {
        key: "active",
        label: "Available for planning",
        kind: "boolean",
        defaultValue: "true",
      },
    ],
  },
  {
    key: "stalls",
    title: "Horse compartments",
    description:
      "A reusable horse enclosure assigned to a horse on a route leg. It is reserved separately from the vehicle; there is no permanent vehicle link. Vehicle stall capacity still limits the number carried.",
    columns: [
      { key: "stallCode", label: "Compartment code" },
      { key: "stallType", label: "Compartment type" },
      { key: "capacity", label: "Horse capacity" },
      { key: "active", label: "Available" },
    ],
    fields: [
      {
        key: "stallCode",
        label: "Compartment code · assigned by the system",
        kind: "generated",
      },
      {
        key: "stallType",
        label: "Compartment type",
        kind: "text",
        help: "Optional description, for example single-horse compartment or quarantine stall.",
      },
      {
        key: "capacity",
        label: "Horse capacity",
        kind: "number",
        min: 1,
        step: 1,
        required: true,
        help: "How many horses can be assigned to this compartment.",
      },
      {
        key: "active",
        label: "Available for assignment",
        kind: "boolean",
        defaultValue: "true",
      },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  {
    key: "countries",
    title: "Countries",
    description:
      "Countries currently supported by the service. Locations and international compliance routes refer to these records.",
    columns: [
      { key: "isoCode", label: "ISO code" },
      { key: "name", label: "Country" },
      { key: "active", label: "Supported" },
    ],
    fields: [
      {
        key: "isoCode",
        label: "ISO 3166-1 alpha-2 code",
        kind: "text",
        required: true,
        maxLength: 2,
        help: "Two-letter country code, for example VN or SG.",
      },
      { key: "name", label: "Country name", kind: "text", required: true },
      {
        key: "active",
        label: "Supported for routes",
        kind: "boolean",
        defaultValue: "true",
      },
    ],
  },
  {
    key: "airlines",
    title: "Airlines",
    description:
      "Air carriers approved for horse cargo bookings. The airline code is the carrier code, not a system record ID.",
    columns: [
      { key: "airlineCode", label: "Airline code" },
      { key: "name", label: "Airline" },
      { key: "active", label: "Available" },
    ],
    fields: [
      {
        key: "airlineCode",
        label: "Airline code (IATA)",
        kind: "text",
        required: true,
        maxLength: 3,
        help: "Enter the carrier code, for example VN or SQ.",
      },
      { key: "name", label: "Airline name", kind: "text", required: true },
      {
        key: "active",
        label: "Available for booking",
        kind: "boolean",
        defaultValue: "true",
      },
    ],
  },
  {
    key: "flight-bookings",
    title: "Flight options",
    description:
      "Select a flight option supplied by the internal schedule. Demo inventory is synthetic and must be checked with the carrier before real transport.",
    columns: [
      { key: "bookingReference", label: "Schedule reference" },
      { key: "airlineId", label: "Airline" },
      { key: "flightNumber", label: "Flight" },
      { key: "originAirportId", label: "From" },
      { key: "destinationAirportId", label: "To" },
      { key: "scheduledDepartureAt", label: "Departure" },
      { key: "scheduledArrivalAt", label: "Arrival" },
      { key: "confirmationStatus", label: "Confirmation" },
    ],
    fields: [
      {
        key: "bookingReference",
        label: "Air cargo booking reference",
        kind: "text",
        required: true,
      },
      {
        key: "airlineId",
        label: "Airline",
        kind: "select",
        source: "airlines",
        required: true,
      },
      {
        key: "flightNumber",
        label: "Flight number",
        kind: "text",
        required: true,
      },
      {
        key: "originAirportId",
        label: "Origin airport",
        kind: "select",
        source: "airports",
        required: true,
      },
      {
        key: "destinationAirportId",
        label: "Destination airport",
        kind: "select",
        source: "airports",
        required: true,
      },
      {
        key: "scheduledDepartureAt",
        label: "Scheduled departure",
        kind: "datetime",
        required: true,
      },
      {
        key: "scheduledArrivalAt",
        label: "Scheduled arrival",
        kind: "datetime",
        required: true,
      },
    ],
  },
];

function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.category === "network") return error.message;
    if (error.category === "permission")
      return `Access denied (${error.status}): ${error.message}`;
    if (error.category === "validation")
      return `Please check the submitted information: ${error.message}`;
    return `Service error (${error.status}): ${error.message}`;
  }
  return error instanceof Error ? error.message : "Unexpected error";
}
const osmSearchUrl = (query: string) =>
  `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
function straightLineDistanceKm(a: MapPoint, b: MapPoint) {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(h));
}
async function openSecureDocument(
  document: ComplianceDocument,
  report: (message: string) => void,
) {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) {
    report("Allow pop-ups to open the document preview.");
    return;
  }
  try {
    const file = await downloadFile(
      `/api/v1/compliance/documents/${document.id}/file`,
    );
    const extension = document.fileName.split(".").pop()?.toLowerCase();
    const mime =
      extension === "pdf"
        ? "application/pdf"
        : extension === "png"
          ? "image/png"
          : ["jpg", "jpeg"].includes(extension ?? "")
            ? "image/jpeg"
            : extension === "webp"
              ? "image/webp"
              : "application/octet-stream";
    const previewUrl = URL.createObjectURL(new Blob([file], { type: mime }));
    previewWindow.location.href = previewUrl;
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
  } catch (error) {
    previewWindow.close();
    report(errorText(error));
  }
}
function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value?: string | number | boolean;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        required={required}
        type={type === "boolean" ? "checkbox" : type}
        checked={type === "boolean" ? Boolean(value) : undefined}
        value={type !== "boolean" ? String(value ?? "") : undefined}
        onChange={(e) =>
          onChange(
            type === "boolean" ? String(e.target.checked) : e.target.value,
          )
        }
      />
    </label>
  );
}

const emptyPagination: PaginationMeta = {
  page: 0,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
};
const emptyRouteShape: RouteShapePoint[] = [];
function requestHorseLabel(horseNames: string, horseCount: number) {
  const names = horseNames
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length) return `${horseCount} horse(s)`;
  return names.length > 2
    ? `${names.slice(0, 2).join(", ")} … +${Math.max(horseCount - 2, names.length - 2)}`
    : names.join(", ");
}
const requestsSteps = [
  "Pickup and delivery",
  "Horses and timing",
  "Documents and review",
] as const;
const requestStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "In review",
  NEED_INFORMATION: "Needs information",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};
const requestStatusLabel = (status: string) =>
  requestStatusLabels[status.toUpperCase()] ?? status.replaceAll("_", " ");
function estimatedArrivalWindow(
  route: RouteCapabilities | null,
  mode: string,
  departureValue: string,
  priority = "STANDARD",
): string {
  const configured = route?.estimatedDurations?.find(
    (item) => item.mode === mode,
  );
  const range =
    priority === "EXPRESS" &&
    configured?.minExpressDurationMinutes &&
    configured.maxExpressDurationMinutes
      ? {
          minDurationMinutes: configured.minExpressDurationMinutes,
          maxDurationMinutes: configured.maxExpressDurationMinutes,
        }
      : priority === "EXPRESS"
        ? null
        : configured;
  if (!range)
    return priority === "EXPRESS"
      ? "Express delivery is not configured for this route and mode. Choose Standard or ask Logistics to configure it."
      : "No travel-time estimate is configured for this route and mode. Logistics will confirm arrival after planning.";
  const departure = new Date(departureValue);
  if (Number.isNaN(departure.valueOf()))
    return "Choose a departure time to see the estimated arrival window.";
  const earliest = new Date(
    departure.getTime() + range.minDurationMinutes * 60_000,
  );
  const latest = new Date(
    departure.getTime() + range.maxDurationMinutes * 60_000,
  );
  return `Estimated ${earliest.toLocaleString()} – ${latest.toLocaleString()}. Logistics will confirm the schedule.`;
}
const toLocalDateTime = (value?: string) =>
  value
    ? new Date(
        new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
const utcDate = (value: unknown) => {
  const raw = String(value);
  return new Date(/(?:z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`);
};
const formatDateTime = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};
const legLocalDateTime = (value: unknown) => {
  const date = utcDate(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
};
const localDateTimeAfterDays = (days: number) =>
  new Date(
    Date.now() +
      days * 24 * 60 * 60 * 1000 -
      new Date().getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);
function departureValidationMessage(
  value: string,
  leadTime: BookingLeadTimeInfo | null,
  enforceLeadTime = true,
): string {
  if (!value) return "Choose a departure date and time.";
  const departure = new Date(value);
  if (Number.isNaN(departure.valueOf()))
    return "Enter a valid departure date and time.";
  if (departure <= new Date()) return "Departure must be in the future.";
  if (!enforceLeadTime) return "";
  const days = leadTime?.minimumLeadTimeDays ?? 5;
  const earliest = leadTime
    ? new Date(leadTime.earliestDepartureAt)
    : new Date(Date.now() + days * 86400000);
  if (departure < earliest)
    return `Choose a departure at least ${days} days from now.`;
  return "";
}

function Pagination({
  value,
  onChange,
}: {
  value: PaginationMeta;
  onChange: (page: number, pageSize: number) => void;
}) {
  if (value.totalItems === 0) return null;
  return (
    <div className="pagination">
      <span>
        {value.totalItems} item{value.totalItems === 1 ? "" : "s"}
      </span>
      <div className="pagination-controls">
        <label>
          Rows
          <select
            aria-label="Rows per page"
            value={value.pageSize}
            onChange={(e) => onChange(0, Number(e.target.value))}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
        <button
          className="ghost small"
          disabled={value.page <= 0}
          onClick={() => onChange(value.page - 1, value.pageSize)}
        >
          Previous
        </button>
        <b>
          Page {value.page + 1} of {Math.max(value.totalPages, 1)}
        </b>
        <button
          className="ghost small"
          disabled={value.page + 1 >= value.totalPages}
          onClick={() => onChange(value.page + 1, value.pageSize)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function ListFilters({
  query,
  status,
  statuses,
  placeholder,
  onQueryChange,
  onStatusChange,
  onSearch,
  onClear,
}: {
  query: string;
  status: string;
  statuses: string[];
  placeholder: string;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
}) {
  return (
    <form
      className="filter-bar"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
    >
      <label className="search-field">
        <span>Search</span>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
        />
      </label>
      <label>
        <span>Status</span>
        <select value={status} onChange={(e) => onStatusChange(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {requestStatusLabels[item] ?? item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <div className="filter-actions">
        <button>Search</button>
        {(query || status) && (
          <button type="button" className="ghost" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </form>
  );
}

type NavGroup = { label: string; items: { id: string; label: string }[] };
function navigationFor(role: string): NavGroup[] {
  const manager = role === "LOGISTICS_MANAGER";
  const complianceItems = [
    ...(["CUSTOMER", "COMPLIANCE_OFFICER", "ADMIN"].includes(role)
      ? [{ id: "Compliance documents", label: "Documents" }]
      : []),
    ...(["COMPLIANCE_OFFICER", "ADMIN"].includes(role)
      ? [{ id: "Compliance rules", label: "Document rules" }]
      : []),
    ...(["TRANSPORT_SPECIALIST", "LOGISTICS_MANAGER", "ADMIN"].includes(role)
      ? [{ id: "Compliance readiness", label: "Trip readiness" }]
      : []),
    ...([
      "COMPLIANCE_OFFICER",
      "ADMIN",
      "LOGISTICS_MANAGER",
      "TRANSPORT_SPECIALIST",
      "FLEET_ROUTE_COORDINATOR",
    ].includes(role)
      ? [{ id: "Border clearance", label: "Border clearance" }]
      : []),
  ];
  if (role === "CUSTOMER")
    return [
      {
        label: "Booking",
        items: [
          { id: "My horses", label: "My horses" },
          { id: "Horse requests", label: "Horse requests" },
          { id: "Journey & delivery", label: "Journey & delivery" },
        ],
      },
      {
        label: "Account",
        items: [{ id: "Notifications", label: "Notifications" }],
      },
    ];
  if (role === "DRIVER" || role === "ESCORT" || role === "DRIVER_ESCORT")
    return [
      {
        label: "Driver workspace",
        items: [
          { id: "Execution", label: "Assigned trips" },
          { id: "Tracking", label: "Live tracking" },
          { id: "Incidents", label: "Report an incident" },
          { id: "Handover", label: "Horse handover" },
        ],
      },
      {
        label: "Account",
        items: [{ id: "Notifications", label: "Notifications" }],
      },
    ];
  if (role === "ADMIN")
    return [
      {
        label: "Administration",
        items: [{ id: "Dashboard", label: "Operations dashboard" }],
      },
      {
        label: "Dispatch",
        items: [{ id: "Request review", label: "Transport requests" }],
      },
      {
        label: "Planning",
        items: [
          { id: "Trips", label: "Trips, routes & assignments" },
          { id: "Route templates", label: "Route templates" },
          { id: "Route capabilities", label: "Supported routes" },
        ],
      },
      {
        label: "Fleet & reference data",
        items: fleet.map((item) => ({
          id: `Fleet/${item.key}`,
          label: item.title,
        })),
      },
      { label: "Compliance", items: complianceItems },
      {
        label: "Operations",
        items: [
          "Execution",
          "Tracking",
          "Health",
          "Incidents",
          "Handover",
          "Route changes",
        ].map((id) => ({ id, label: id })),
      },
      {
        label: "Reporting",
        items: [{ id: "Pricing & billing", label: "Pricing & billing" }, { id: "KPI & audit", label: "KPI & audit" }],
      },
      {
        label: "Account",
        items: [{ id: "Notifications", label: "Notifications" }],
      },
    ];
  if (manager)
    return [
      { label: "Overview", items: [{ id: "Dashboard", label: "Dashboard" }] },
      {
        label: "Dispatch",
        items: [{ id: "Request review", label: "Transport requests" }],
      },
      { label: "Planning", items: [{ id: "Trips", label: "Route approval" }] },
      { label: "Compliance", items: complianceItems },
      {
        label: "Operations",
        items: [
          "Tracking",
          "Health",
          "Incidents",
          "Handover",
          "Route changes",
        ].map((id) => ({ id, label: id })),
      },
      {
        label: "Reporting",
        items: [{ id: "Pricing & billing", label: "Pricing & billing" }, { id: "KPI & audit", label: "KPI & audit" }],
      },
      {
        label: "Account",
        items: [{ id: "Notifications", label: "Notifications" }],
      },
    ];
  if (role === "COMPLIANCE_OFFICER")
    return [
      { label: "Compliance", items: complianceItems },
      {
        label: "Account",
        items: [{ id: "Notifications", label: "Notifications" }],
      },
    ];
  if (role === "TRANSPORT_SPECIALIST" || role === "FLEET_ROUTE_COORDINATOR")
    return [
      {
        label: "Logistics",
        items: [
          { id: "Trips", label: "Route planning & dispatch" },
          { id: "Route templates", label: "Route templates" },
        ],
      },
      {
        label: "Fleet & reference data",
        items: fleet.map((item) => ({
          id: `Fleet/${item.key}`,
          label: item.title,
        })),
      },
      { label: "Compliance", items: complianceItems },
      {
        label: "Reporting",
        items: [{ id: "KPI & audit", label: "KPI & audit" }],
      },
      {
        label: "Account",
        items: [{ id: "Notifications", label: "Notifications" }],
      },
    ];
  return [
    {
      label: "Operations",
      items: ["Execution", "Tracking", "Health", "Incidents", "Handover"].map(
        (id) => ({ id, label: id }),
      ),
    },
    {
      label: "Account",
      items: [{ id: "Notifications", label: "Notifications" }],
    },
  ];
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [showAuth, setShowAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [page, setPage] = useState("Horse requests");
  const [focusedRequestId, setFocusedRequestId] = useState("");
  const [portalPaymentRequestId, setPortalPaymentRequestId] = useState("");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [toastPaused, setToastPaused] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const toastStartedAt = useRef(0);
  const toastRemaining = useRef(0);
  const toastPausedRef = useRef(false);
  const dismissToast = useCallback(() => {
    setError("");
    setNotice("");
  }, []);
  const runToastTimer = useCallback(() => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    if (toastRemaining.current <= 0) {
      dismissToast();
      return;
    }
    toastStartedAt.current = Date.now();
    toastTimer.current = window.setTimeout(
      dismissToast,
      toastRemaining.current,
    );
  }, [dismissToast]);
  const activeToastKey = error
    ? `error:${error}`
    : notice
      ? `success:${notice}`
      : "";
  const toastDuration = error ? 4500 : 3500;
  const report = useCallback((message: string) => {
    setError(message);
    if (message) setNotice("");
  }, []);
  const notify = useCallback((message: string) => {
    setNotice(message);
    if (message) setError("");
  }, []);
  useEffect(() => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = null;
    if (!activeToastKey) {
      toastRemaining.current = 0;
      toastPausedRef.current = false;
      setToastPaused(false);
      return;
    }
    toastRemaining.current = toastDuration;
    if (!toastPausedRef.current) runToastTimer();
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      toastTimer.current = null;
    };
  }, [activeToastKey, toastDuration, runToastTimer]);
  function pauseToastCountdown() {
    if (toastPausedRef.current) return;
    toastPausedRef.current = true;
    setToastPaused(true);
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current);
      toastTimer.current = null;
      toastRemaining.current = Math.max(
        0,
        toastRemaining.current - (Date.now() - toastStartedAt.current),
      );
    }
  }
  function resumeToastCountdown() {
    if (!toastPausedRef.current) return;
    toastPausedRef.current = false;
    setToastPaused(false);
    if (activeToastKey) runToastTimer();
  }
  useEffect(() => {
    restoreSession()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get("requestId");
    const orderId = params.get("orderId");
    const shouldPay = params.get("pay") === "1";
    setPage("Horse requests");
    if (requestId) {
      setFocusedRequestId(requestId);
      if (shouldPay) setPortalPaymentRequestId(requestId);
      return;
    }
    if (orderId) {
      void getOrderStatus(orderId)
        .then((order) => {
          setFocusedRequestId(order.requestId);
          setPage("Horse requests");
        })
        .catch(() => undefined);
    }
  }, [user?.id]);
  useEffect(() => {
    setError("");
    setNotice("");
  }, [page]);
  const refreshNotificationCount = useCallback(() => {
    if (!user) return;
    getUnreadNotificationCount()
      .then((result) => setUnreadNotificationCount(result.unreadCount))
      .catch(() => undefined);
  }, [user?.id]);
  useEffect(() => {
    if (user) refreshNotificationCount();
    else setUnreadNotificationCount(0);
  }, [user, refreshNotificationCount]);
  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const account = await login(email, password);
      setUser(account);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function signUp(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const account = await registerCustomer({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      setUser(account);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function changeAuthMode(mode: "login" | "register") {
    setAuthMode(mode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }
  async function signOut() {
    await logout();
    setUser(null);
    setShowAuth(false);
  }
  function openRequestFromNotification(requestId: string) {
    setFocusedRequestId(requestId);
    setPage("Horse requests");
  }
  if (checking)
    return (
      <main className="center">
        <p>Restoring secure session…</p>
      </main>
    );
  if (!user)
    return (
      <>
        <LandingPage
          onSignIn={() => {
            changeAuthMode("login");
            setShowAuth(true);
          }}
          onRegister={() => {
            changeAuthMode("register");
            setShowAuth(true);
          }}
        />
        {showAuth && (
          <ModalDialog
            title={
              authMode === "register" ? "Create your account" : "Welcome back"
            }
            description={
              authMode === "register"
                ? "Start planning your horse’s journey with EquiRoute."
                : "Sign in to your EquiRoute workspace."
            }
            onClose={() => {
              setShowAuth(false);
              setError("");
            }}
          >
            <section className="auth-modal-content">
              <div
                className="auth-tabs"
                role="tablist"
                aria-label="Account access"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "login"}
                  className={authMode === "login" ? "active" : "ghost"}
                  onClick={() => changeAuthMode("login")}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "register"}
                  className={authMode === "register" ? "active" : "ghost"}
                  onClick={() => changeAuthMode("register")}
                >
                  Create account
                </button>
              </div>
              {authMode === "login" ? (
                <form className="auth-form" onSubmit={signIn}>
                  <div>
                    <h1>Welcome back</h1>
                    <p>Sign in with your customer or operations account.</p>
                  </div>
                  {error && (
                    <p className="auth-error" role="alert">
                      {error}
                    </p>
                  )}
                  <Input
                    label="Email"
                    value={email}
                    onChange={setEmail}
                    type="email"
                    required
                  />
                  <Input
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    type="password"
                    required
                  />
                  <button disabled={busy}>
                    {busy ? "Signing in…" : "Sign in"}
                  </button>
                  <p className="auth-switch">
                    New to EquiRoute?{" "}
                    <button
                      type="button"
                      onClick={() => changeAuthMode("register")}
                    >
                      Create an account
                    </button>
                  </p>
                </form>
              ) : (
                <form className="auth-form" onSubmit={signUp}>
                  <div>
                    <h1>Create customer account</h1>
                    <p>Register to manage horses and transport requests.</p>
                  </div>
                  {error && (
                    <p className="auth-error" role="alert">
                      {error}
                    </p>
                  )}
                  <Input
                    label="Full name"
                    value={fullName}
                    onChange={setFullName}
                    required
                  />
                  <Input
                    label="Email"
                    value={email}
                    onChange={setEmail}
                    type="email"
                    required
                  />
                  <Input
                    label="Phone (optional)"
                    value={phone}
                    onChange={setPhone}
                    type="tel"
                  />
                  <label>
                    Password
                    <span className="field-hint">
                      Use at least 8 characters
                    </span>
                    <input
                      required
                      type="password"
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                  <Input
                    label="Confirm password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    type="password"
                    required
                  />
                  <button disabled={busy}>
                    {busy ? "Creating account…" : "Create account"}
                  </button>
                  <p className="auth-switch">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => changeAuthMode("login")}
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              )}
            </section>
          </ModalDialog>
        )}
      </>
    );
  if (!allowedRoles.includes(user.role.toUpperCase()))
    return (
      <main className="center">
        <section className="panel">
          <h1>Workspace access unavailable</h1>
          <p>Your account role ({user.role}) has no matching workspace.</p>
          <button onClick={signOut}>Sign out</button>
        </section>
      </main>
    );
  const role = user.role.toUpperCase();
  const groups = navigationFor(role);
  const pages = groups.flatMap((group) => group.items.map((item) => item.id));
  const activePage =
    pages.includes(page) || (role === "CUSTOMER" && page === "My horses")
      ? page
      : pages[0];
  const fleetResourceKey = activePage.startsWith("Fleet/")
    ? activePage.slice("Fleet/".length)
    : undefined;
  const activePageLabel = fleetResourceKey
    ? (fleet.find((item) => item.key === fleetResourceKey)?.title ??
      "Fleet & reference data")
    : activePage;
  const operationSection =
    activePage === "Journey & delivery"
      ? "Handover"
      : activePage === "Timeline"
      ? "Execution"
      : (activePage as
          | "Execution"
          | "Tracking"
          | "Health"
          | "Incidents"
          | "Handover"
          | "Notifications"
          | "Route changes"
          | "KPI & audit"
          | "Pricing & billing");
  const complianceSection =
    activePage === "Compliance documents"
      ? "documents"
      : activePage === "Compliance readiness"
        ? "readiness"
        : activePage === "Border clearance"
          ? "clearance"
          : null;
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          Equi<span>Route</span>
          <small>TRANSPORT OPERATIONS</small>
        </div>
        <nav className="nav" aria-label="Main navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-title">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={activePage === item.id ? "active" : ""}
                  onClick={() => setPage(item.id)}
                >
                  <span className="nav-dot" />
                  {item.label}
                  {item.id === "Notifications" &&
                    unreadNotificationCount > 0 && (
                      <small className="notification-count">
                        {unreadNotificationCount}
                      </small>
                    )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button
          className="profile"
          onClick={() => role === "CUSTOMER" && setProfileOpen(true)}
          aria-label={role === "CUSTOMER" ? "Open customer profile" : undefined}
        >
          <div className="avatar">
            {user.fullName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <b>{user.fullName}</b>
            <small>
              {role === "TRANSPORT_SPECIALIST" ? "Logistics" : user.role}
            </small>
          </div>
        </button>
      </aside>
      <div className="workspace">
        <header>
          <div>
            <p>EquiRoute · Transport operations</p>
            <h1>{activePageLabel}</h1>
          </div>
          <div className="header-actions">
            <span className="account">{user.email}</span>
            {role === "CUSTOMER" && (
              <button
                className="profile-icon"
                onClick={() => setProfileOpen(true)}
                aria-label="Edit customer profile"
                title="Customer profile"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />
                </svg>
              </button>
            )}
            <button className="ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        {(error || notice) && (
          <div
            className="toast-stack"
            aria-live="polite"
            onMouseEnter={pauseToastCountdown}
            onMouseLeave={resumeToastCountdown}
          >
            {error && (
              <div
                className={`toast error${toastPaused ? " paused" : ""}`}
                role="alert"
              >
                <span className="toast-icon" aria-hidden="true">
                  !
                </span>
                <span className="toast-message">{error}</span>
                <button
                  className="toast-dismiss"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  ×
                </button>
                <div className="toast-countdown" aria-hidden="true">
                  <span style={{ animationDuration: "4500ms" }} />
                </div>
              </div>
            )}
            {notice && (
              <div
                className={`toast success${toastPaused ? " paused" : ""}`}
                role="status"
              >
                <span className="toast-icon" aria-hidden="true">
                  ✓
                </span>
                <span className="toast-message">{notice}</span>
                <button
                  className="toast-dismiss"
                  aria-label="Dismiss notification"
                  onClick={() => setNotice("")}
                >
                  ×
                </button>
                <div className="toast-countdown" aria-hidden="true">
                  <span style={{ animationDuration: "3500ms" }} />
                </div>
              </div>
            )}
          </div>
        )}
        {activePage === "Dashboard" ? (
          <DashboardView userName={user.fullName} report={report} />
        ) : activePage === "Route capabilities" ? (
          <RouteCapabilitiesView notify={notify} />
        ) : activePage === "Compliance rules" ? (
          <RegulationRulesView />
        ) : activePage === "Route templates" ? (
          <RouteTemplatesView report={report} notify={notify} />
        ) : activePage === "Trips" ? (
          <TripsView
            role={role}
            focusTripId=""
            focusHorseOptions={[]}
            onFocusHandled={() => undefined}
            report={report}
            notify={notify}
          />
        ) : fleetResourceKey ? (
          <FleetView
            resourceKey={fleetResourceKey as ResourceName}
            role={role}
            report={report}
            notify={notify}
          />
        ) : activePage === "Request review" ? (
          <ReviewView report={report} notify={notify} />
        ) : activePage === "My horses" ? (
          <BookingView section="horses" report={report} notify={notify} />
        ) : activePage === "Horse requests" ||
          activePage === "Transport requests" ? (
          <BookingView
            section="requests"
            report={report}
            notify={notify}
            onOpenJourney={() => setPage("Journey & delivery")}
            focusRequestId={focusedRequestId}
            onRequestFocusHandled={() => setFocusedRequestId("")}
            autoPayRequestId={portalPaymentRequestId}
            onPaymentActionHandled={() => setPortalPaymentRequestId("")}
          />
        ) : complianceSection ? (
          <ComplianceView
            section={complianceSection}
            role={role}
            report={report}
            notify={notify}
          />
        ) : (
          <OperationsView
            section={operationSection}
            role={role}
            report={report}
            notify={notify}
            onOpenRequest={openRequestFromNotification}
            onNotificationsChanged={refreshNotificationCount}
          />
        )}
        {profileOpen && (
          <CustomerProfileModal
            user={user}
            onClose={() => setProfileOpen(false)}
            report={report}
            notify={notify}
          />
        )}
      </div>
    </div>
  );
}

function CustomerProfileModal({
  user,
  onClose,
  report,
  notify,
}: {
  user: User;
  onClose: () => void;
  report: (s: string) => void;
  notify: (s: string) => void;
}) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<CountryReference[]>([]);
  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 404)) report(errorText(e));
      })
      .finally(() => setLoading(false));
  }, [report]);
  useEffect(() => {
    getCustomerCountries()
      .then(setCountries)
      .catch((e) => report(errorText(e)));
  }, [report]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    report("");
    setBusy(true);
    try {
      setProfile(
        await saveProfile({
          name: String(f.get("name")),
          customerType: String(f.get("customerType")),
          contactPerson: String(f.get("contactPerson") || ""),
          phone: String(f.get("phone") || ""),
          address: String(f.get("address") || ""),
          countryId: String(f.get("countryId") || "") || undefined,
          versionNo: profile?.versionNo,
        }),
      );
      report("");
      notify("Customer profile saved.");
      onClose();
    } catch (e) {
      report(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
      >
        <div className="panel-title">
          <div>
            <h2 id="profile-title">Customer profile</h2>
            <p>Account and contact details used for bookings.</p>
          </div>
          <button
            className="icon-close ghost"
            onClick={onClose}
            aria-label="Close profile"
          >
            ×
          </button>
        </div>
        {loading ? (
          <p className="modal-loading">Loading profile…</p>
        ) : (
          <>
            <section
              className="profile-account"
              aria-label="Registered account information"
            >
              <h3>Registered account</h3>
              <div className="profile-account-grid">
                <div>
                  <small>Full name</small>
                  <b>{user.fullName}</b>
                </div>
                <div>
                  <small>Email</small>
                  <b>{user.email}</b>
                </div>
              </div>
            </section>
            <form
              className="form-grid profile-form"
              key={`${profile?.id ?? "new"}-${profile?.versionNo ?? 0}-${countries.length}`}
              onSubmit={save}
            >
              <h3>Booking profile</h3>
              <label>
                Customer name
                <input
                  name="name"
                  defaultValue={profile?.name ?? user.fullName}
                  required
                />
              </label>
              <label>
                Customer type
                <select
                  name="customerType"
                  defaultValue={profile?.customerType ?? "INDIVIDUAL_OWNER"}
                >
                  <option value="INDIVIDUAL_OWNER">Individual</option>
                  <option value="CLUB">Club</option>
                  <option value="BREEDER">Breeder</option>
                  <option value="AGENT">Agent</option>
                </select>
              </label>
              <label>
                Contact person
                <input
                  name="contactPerson"
                  defaultValue={profile?.contactPerson ?? user.fullName}
                />
              </label>
              <label>
                Phone
                <input
                  name="phone"
                  type="tel"
                  defaultValue={profile?.phone ?? ""}
                />
              </label>
              <label className="span-2">
                Address
                <input name="address" defaultValue={profile?.address ?? ""} />
              </label>
              <label>
                Country
                <select
                  name="countryId"
                  defaultValue={profile?.countryId ?? ""}
                >
                  <option value="">Choose a country (optional)</option>
                  {countries
                    .filter(
                      (country) =>
                        country.active || country.id === profile?.countryId,
                    )
                    .map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="modal-actions">
                <button type="button" className="ghost" onClick={onClose}>
                  Cancel
                </button>
                <button disabled={busy}>
                  {busy ? "Saving…" : "Save profile"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function ActionModal({
  title,
  description,
  onClose,
  children,
  className = "",
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal modal-wide ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-modal-title"
      >
        <div className="panel-title">
          <div>
            <h2 id="action-modal-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button
            className="icon-close ghost"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function BookingView({
  section,
  report,
  notify,
  onOpenJourney,
  focusRequestId,
  onRequestFocusHandled,
  autoPayRequestId,
  onPaymentActionHandled,
}: {
  section: "horses" | "requests";
  report: (s: string) => void;
  notify: (s: string) => void;
  onOpenJourney?: () => void;
  focusRequestId?: string;
  onRequestFocusHandled?: () => void;
  autoPayRequestId?: string;
  onPaymentActionHandled?: () => void;
}) {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [customerProfile, setCustomerProfile] =
    useState<CustomerProfile | null>(null);
  const [recipientIsRequester, setRecipientIsRequester] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const customPickupLookupId = useRef(0);
  const [countries, setCountries] = useState<CountryReference[]>([]);
  const [externalCountries, setExternalCountries] = useState<
    { code: string; name: string }[]
  >([]);
  const [externalCountriesLoading, setExternalCountriesLoading] =
    useState(false);
  const [externalCountriesError, setExternalCountriesError] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [requestHorseIds, setRequestHorseIds] = useState<string[]>([]);
  const [originLocationId, setOriginLocationId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [mapLocationTarget, setMapLocationTarget] = useState<
    "pickup" | "delivery"
  >("pickup");
  const [mapFocusVersion, setMapFocusVersion] = useState(0);
  const [customPickup, setCustomPickup] = useState<{
    point: MapPoint;
    label?: string;
  } | null>(null);
  const [nearestReceiving, setNearestReceiving] = useState<Location | null>(
    null,
  );
  const [nearestReceivingDistance, setNearestReceivingDistance] = useState<
    number | null
  >(null);
  const [nearestReceivingLoading, setNearestReceivingLoading] = useState(false);
  const [pickupRoadDistance, setPickupRoadDistance] = useState<{
    km: number | null;
    status: "loading" | "ready" | "unavailable";
  }>({ km: null, status: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [requestFormError, setRequestFormError] = useState("");
  const [requestFieldErrors, setRequestFieldErrors] = useState<
    Record<string, string>
  >({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [requestStep, setRequestStep] = useState(0);
  const [requestSuccess, setRequestSuccess] = useState<{
    id: string;
    requestNo: string;
  } | null>(null);
  const [requestSummary, setRequestSummary] = useState<{
    departure: string;
    arrival: string;
    mode: string;
    priority: string;
    notes: string;
  } | null>(null);
  const [departurePreview, setDeparturePreview] = useState("");
  const [modePreview, setModePreview] = useState("");
  const [priorityPreview, setPriorityPreview] = useState("STANDARD");
  const [pendingDraft, setPendingDraft] = useState<{
    id: string;
    versionNo: number;
    status?: string;
    reviewReason?: string;
    input: {
      originLocationId: string;
      destinationLocationId: string;
      customPickupLatitude?: number;
      customPickupLongitude?: number;
      customPickupLabel?: string;
      requestedDepartureAt: string;
      requestedArrivalAt?: string;
      preferredTransportMode: string;
      deliveryPriority: string;
      notes: string;
      horseIds: string[];
      recipientIsRequester: boolean;
      recipientName?: string;
      recipientPhone?: string;
      recipientEmail?: string;
    };
  } | null>(null);
  const [draftCreationKey, setDraftCreationKey] = useState(
    () => sessionStorage.getItem("equroute.draftCreationKey") ?? "",
  );
  const [bookingLeadTime, setBookingLeadTime] =
    useState<BookingLeadTimeInfo | null>(null);
  const [leadTimeLoading, setLeadTimeLoading] = useState(false);
  const [routeCapabilities, setRouteCapabilities] =
    useState<RouteCapabilities | null>(null);
  const [routeCapabilitiesLoading, setRouteCapabilitiesLoading] =
    useState(false);
  const [documentChecklist, setDocumentChecklist] =
    useState<RequestDocumentChecklist | null>(null);
  const [requiredDocumentTypes, setRequiredDocumentTypes] = useState<
    DocumentType[]
  >([]);
  const [uploadFiles, setUploadFiles] = useState<Record<string, File>>({});
  const [uploadExpiry, setUploadExpiry] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState("");
  const [horseAvailability, setHorseAvailability] =
    useState<HorseAvailability | null>(null);
  const availableRequestHorses = horseAvailability
    ? horses.filter((horse) =>
        horseAvailability.some(
          (item) => item.horseId === horse.id && item.eligible,
        ),
      )
    : [];
  const departureIsValid = !departureValidationMessage(
    departurePreview,
    bookingLeadTime,
  );
  const selectedModeIsValid = Boolean(
    modePreview && routeCapabilities?.allowedModes.includes(modePreview),
  );
  const selectedHorsesAreValid =
    requestHorseIds.length > 0 &&
    requestHorseIds.every((id) =>
      horseAvailability?.some((item) => item.horseId === id && item.eligible),
    );
  const [selectedEstimate, setSelectedEstimate] =
    useState<RouteCapabilities | null>(null);
  const [selectedHorse, setSelectedHorse] = useState<Horse | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<TransportRequest | null>(null);
  const [requestPayment, setRequestPayment] = useState<
    import("../features/booking/api").PaymentInvoice | null
  >(null);
  const [requestPaymentLoading, setRequestPaymentLoading] = useState(false);
  const [requestPaymentBusy, setRequestPaymentBusy] = useState(false);
  const [requestHistory, setRequestHistory] = useState<
    TransportRequestHistoryEntry[]
  >([]);
  const [requestActorNames, setRequestActorNames] = useState<
    Record<string, string>
  >({});
  const [requestHistoryLoading, setRequestHistoryLoading] = useState(false);
  const [customerRequestDocuments, setCustomerRequestDocuments] = useState<
    ComplianceDocument[]
  >([]);
  const [customerRequestDocumentsLoading, setCustomerRequestDocumentsLoading] =
    useState(false);
  const [horseDetailLoading, setHorseDetailLoading] = useState(false);
  const [horsePagination, setHorsePagination] = useState(emptyPagination);
  const [requestPagination, setRequestPagination] = useState(emptyPagination);
  const [horseQuery, setHorseQuery] = useState("");
  const [horseSearch, setHorseSearch] = useState("");
  const [horseStatus, setHorseStatus] = useState("");
  const [requestQuery, setRequestQuery] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [requestSortBy, setRequestSortBy] = useState<"departure" | "request">(
    "departure",
  );
  const [requestSortDirection, setRequestSortDirection] = useState<
    "asc" | "desc"
  >("asc");
  const [horseSortBy, setHorseSortBy] = useState<"name" | "status">("name");
  const [horseSortDirection, setHorseSortDirection] = useState<"asc" | "desc">(
    "asc",
  );
  const onPickupRouteDistance = useCallback(
    (value: {
      km: number | null;
      status: "loading" | "ready" | "unavailable";
    }) => setPickupRoadDistance(value),
    [],
  );
  const reload = useCallback(async () => {
    try {
      if (section === "horses") {
        const result = await getHorses(
          horsePagination.page,
          horsePagination.pageSize,
          horseSearch,
          horseStatus,
          horseSortBy,
          horseSortDirection,
        );
        setHorses(result.data);
        setHorsePagination(result.pagination);
      } else {
        const [h, r, l] = await Promise.all([
          getHorses(0, 100),
          getRequests(
            requestPagination.page,
            requestPagination.pageSize,
            requestSearch,
            requestStatus,
            requestSortBy,
            requestSortDirection,
          ),
          getBookingLocations(),
        ]);
        setHorses(h.data);
        setRequests(r.data);
        setRequestPagination(r.pagination);
        setLocations(l.data.filter((location) => location.active));
      }
    } catch (e) {
      report(errorText(e));
    }
  }, [
    section,
    horsePagination.page,
    horsePagination.pageSize,
    horseSearch,
    horseStatus,
    horseSortBy,
    horseSortDirection,
    requestPagination.page,
    requestPagination.pageSize,
    requestSearch,
    requestStatus,
    requestSortBy,
    requestSortDirection,
    report,
  ]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (section === "requests")
      getProfile()
        .then(setCustomerProfile)
        .catch((e) => {
          if (!(e instanceof ApiError && e.status === 404))
            report(errorText(e));
        });
  }, [section, report]);
  const loadExternalCountries = useCallback(async () => {
    setExternalCountriesLoading(true);
    setExternalCountriesError("");
    try {
      const response = await fetch(
        "https://countriesnow.space/api/v0.1/countries/iso",
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok)
        throw new Error(`CountriesNow returned HTTP ${response.status}.`);
      const payload = (await response.json()) as {
        error?: boolean;
        data?: { Iso2?: string; name?: string }[];
      };
      const countries = (payload.data ?? [])
        .filter((row) => row.Iso2 && row.name)
        .map((row) => ({ code: row.Iso2!, name: row.name! }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (payload.error || !countries.length)
        throw new Error("CountriesNow returned an empty country list.");
      setExternalCountries(countries);
    } catch (error) {
      setExternalCountries([]);
      setExternalCountriesError(
        error instanceof Error
          ? error.message
          : "Could not load countries from CountriesNow.",
      );
    } finally {
      setExternalCountriesLoading(false);
    }
  }, []);
  useEffect(() => {
    if (section !== "horses") return;
    getCustomerCountries()
      .then(setCountries)
      .catch((e) => report(errorText(e)));
    void loadExternalCountries();
  }, [section, report, loadExternalCountries]);
  useEffect(() => {
    if (
      section !== "requests" ||
      !createOpen ||
      !originLocationId ||
      !destinationLocationId ||
      originLocationId === destinationLocationId
    ) {
      setBookingLeadTime(null);
      setLeadTimeLoading(false);
      return;
    }
    let cancelled = false;
    setLeadTimeLoading(true);
    getBookingLeadTime(originLocationId, destinationLocationId)
      .then((result) => {
        if (!cancelled) setBookingLeadTime(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setBookingLeadTime(null);
          report(errorText(error));
        }
      })
      .finally(() => {
        if (!cancelled) setLeadTimeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, createOpen, originLocationId, destinationLocationId, report]);
  useEffect(() => {
    if (
      section !== "requests" ||
      !createOpen ||
      !originLocationId ||
      !destinationLocationId ||
      originLocationId === destinationLocationId
    ) {
      setRouteCapabilities(null);
      setRouteCapabilitiesLoading(false);
      return;
    }
    let cancelled = false;
    setRouteCapabilitiesLoading(true);
    getRouteCapabilities(originLocationId, destinationLocationId)
      .then((result) => {
        if (!cancelled) setRouteCapabilities(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setRouteCapabilities(null);
          setRequestFormError(errorText(error));
        }
      })
      .finally(() => {
        if (!cancelled) setRouteCapabilitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, createOpen, originLocationId, destinationLocationId]);
  useEffect(() => {
    if (section !== "requests" || !createOpen || !horses.length) {
      setHorseAvailability(null);
      return;
    }
    let cancelled = false;
    getHorseAvailability(
      horses.map((horse) => horse.id),
      pendingDraft?.id,
    )
      .then((result) => {
        if (!cancelled) {
          setHorseAvailability(result);
          setRequestHorseIds((current) =>
            current.filter((id) =>
              result.some((item) => item.horseId === id && item.eligible),
            ),
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setHorseAvailability(null);
          setRequestFormError(errorText(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [section, createOpen, horses, pendingDraft?.id]);
  async function chooseCustomerPickup(
    point: MapPoint | null,
    place?: { name: string; address: string; city: string },
  ) {
    const lookupId = ++customPickupLookupId.current;
    setCustomPickup(
      point
        ? {
            point,
            label:
              [place?.name, place?.address, place?.city]
                .filter(Boolean)
                .join(", ") || undefined,
          }
        : null,
    );
    setNearestReceiving(null);
    setNearestReceivingDistance(null);
    setPickupRoadDistance({ km: null, status: "loading" });
    if (!point) {
      setNearestReceivingLoading(false);
      setPickupRoadDistance({ km: null, status: "unavailable" });
      return;
    }

    // “Use my location” sets the customer's actual collection point. If they
    // already chose a registered pickup in the dropdown, keep that choice and
    // use it as the route hand-off point instead of silently replacing it with
    // whichever receiving location happens to be geographically closest.
    const chosenPickup = locations.find(
      (location) => location.id === originLocationId && location.active,
    );
    if (
      chosenPickup &&
      chosenPickup.latitude != null &&
      chosenPickup.longitude != null
    ) {
      const chosenPickupPoint = {
        latitude: Number(chosenPickup.latitude),
        longitude: Number(chosenPickup.longitude),
      };
      setNearestReceiving(chosenPickup);
      setNearestReceivingDistance(
        straightLineDistanceKm(point, chosenPickupPoint),
      );
      setNearestReceivingLoading(false);
      clearRequestFieldError("originLocationId");
      return;
    }

    setNearestReceivingLoading(true);
    try {
      const nearest = await getNearestReceivingLocation(
        point.latitude,
        point.longitude,
      );
      if (lookupId !== customPickupLookupId.current) return;
      const location = nearest.location as Location;
      setNearestReceiving(location);
      setNearestReceivingDistance(nearest.distanceKm);
      setOriginLocationId(location.id);
      if (!destinationLocationId || destinationLocationId === location.id) {
        const alternativeDestination = locations.find(
          (candidate) => candidate.active && candidate.id !== location.id,
        );
        if (alternativeDestination)
          setDestinationLocationId(alternativeDestination.id);
      }
      clearRequestFieldError("originLocationId");
    } catch (error) {
      if (lookupId === customPickupLookupId.current)
        setRequestFormError(errorText(error));
    } finally {
      if (lookupId === customPickupLookupId.current)
        setNearestReceivingLoading(false);
    }
  }
  async function createHorse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    report("");
    setBusy(true);
    try {
      await saveHorse({
        horseName: String(f.get("horseName")),
        registrationNumber: String(f.get("registrationNumber") || ""),
        passportNumber: String(f.get("passportNumber") || ""),
        breed: String(f.get("breed") || ""),
        sex: String(f.get("sex") || ""),
        dateOfBirth: String(f.get("dateOfBirth") || "") || undefined,
        color: String(f.get("color") || ""),
        countryOfOriginId: countries.find(
          (country) =>
            country.isoCode.toUpperCase() ===
            String(f.get("countryIsoCode") || "").toUpperCase(),
        )?.id,
        countryOfOriginName: externalCountries.find(
          (country) => country.code === String(f.get("countryIsoCode") || ""),
        )?.name,
        specialRequirements: String(f.get("specialRequirements") || ""),
      });
      form.reset();
      setCreateOpen(false);
      report("");
      notify("Horse registered.");
      await reload();
    } catch (e) {
      report(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function openHorseDetails(id: string) {
    setHorseDetailLoading(true);
    report("");
    try {
      const horse = await getHorse(id);
      if (horse.countryOfOriginId) {
        try {
          const country = await getCustomerCountry(horse.countryOfOriginId);
          horse.countryOfOriginName = country.name;
        } catch {
          horse.countryOfOriginName = undefined;
        }
      }
      setSelectedHorse(horse);
    } catch (e) {
      report(errorText(e));
    } finally {
      setHorseDetailLoading(false);
    }
  }
  async function openRequestDetails(id: string) {
    report("");
    setSelectedEstimate(null);
    setRequestPayment(null);
    setRequestPaymentLoading(true);
    setRequestActorNames({});
    setRequestHistoryLoading(true);
    setCustomerRequestDocumentsLoading(true);
    try {
      const [request, history] = await Promise.all([
        getRequest(id),
        getRequestHistory(id),
      ]);
      setSelectedRequest(request);
      if (request.orderId) {
        try {
          setRequestPayment(await getOrderPayment(request.orderId));
        } catch {
          // Approved requests can exist without an invoice when no active
          // pricing rule matched the route at approval time.
          setRequestPayment(null);
        }
      }
      if (request.originLocationId && request.destinationLocationId)
        void getRouteCapabilities(
          request.originLocationId,
          request.destinationLocationId,
        )
          .then(setSelectedEstimate)
          .catch(() => setSelectedEstimate(null));
      setRequestHistory(history);
      setRequestHistoryLoading(false);
      const actorIds = [
        ...new Set(
          history
            .map((event) => event.actorUserId)
            .filter(
              (actorId) => actorId && actorId !== request.createdByUserId,
            ),
        ),
      ];
      if (actorIds.length)
        void getStaffDisplayNames(actorIds)
          .then((actors) =>
            setRequestActorNames(
              Object.fromEntries(
                actors.map((actor) => [actor.id, actor.fullName]),
              ),
            ),
          )
          .catch(() => undefined);
      try {
        const docGroups = await Promise.all([
          getDocuments({ requestId: id }),
          ...request.horseIds.map((horseId) => getDocuments({ horseId })),
        ]);
        const attached = docGroups
          .flat()
          .filter(
            (document) =>
              document.tripId == null &&
              (document.requestId === id ||
                (!document.requestId &&
                  !!document.horseId &&
                  request.horseIds.includes(document.horseId))),
          );
        setCustomerRequestDocuments([
          ...new Map(
            attached.map((document) => [document.id, document]),
          ).values(),
        ]);
      } catch (e) {
        report(errorText(e));
      }
    } catch (e) {
      report(errorText(e));
    } finally {
      setRequestHistoryLoading(false);
      setCustomerRequestDocumentsLoading(false);
      setRequestPaymentLoading(false);
    }
  }
  async function startRequestPayment() {
    if (!selectedRequest?.orderId || requestPaymentBusy) return;
    setRequestPaymentBusy(true);
    try {
      const checkout = await createOrderPaymentCheckout(selectedRequest.orderId);
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      report(errorText(error));
    } finally {
      setRequestPaymentBusy(false);
    }
  }
  useEffect(() => {
    if (section === "requests" && focusRequestId) {
      void openRequestDetails(focusRequestId);
      onRequestFocusHandled?.();
    }
  }, [section, focusRequestId, onRequestFocusHandled]);
  useEffect(() => {
    if (!autoPayRequestId || selectedRequest?.id !== autoPayRequestId || requestPaymentLoading) return;
    onPaymentActionHandled?.();
    if (requestPayment?.status === "PENDING_PAYMENT") void startRequestPayment();
  }, [autoPayRequestId, selectedRequest?.id, requestPayment?.status, requestPaymentLoading, onPaymentActionHandled]);
  async function saveRequestDraft(form: HTMLFormElement | null) {
    if (!form) return;
    const values = new FormData(form);
    const errors: Record<string, string> = {};
    if (!originLocationId)
      errors.originlocationid = "Choose a pickup location.";
    if (!destinationLocationId)
      errors.destinationlocationid = "Choose a delivery location.";
    const departureError = departureValidationMessage(
      String(values.get("requestedDepartureAt") || ""),
      bookingLeadTime,
      false,
    );
    if (departureError) errors.requesteddepartureat = departureError;
    if (Object.keys(errors).length) {
      setRequestFieldErrors(errors);
      return;
    }
    const input = {
      originLocationId,
      destinationLocationId,
      customPickupLatitude: customPickup?.point.latitude,
      customPickupLongitude: customPickup?.point.longitude,
      customPickupLabel: customPickup?.label,
      requestedDepartureAt: new Date(
        String(values.get("requestedDepartureAt")),
      ).toISOString(),
      preferredTransportMode: String(
        values.get("preferredTransportMode") || "ROAD",
      ),
      deliveryPriority: String(values.get("deliveryPriority") || "STANDARD") as
        | "STANDARD"
        | "EXPRESS",
      notes: String(values.get("notes") || ""),
      horseIds: requestHorseIds,
      recipientIsRequester: values.get("recipientIsRequester") === "true",
      recipientName: String(values.get("recipientName") || "").trim(),
      recipientPhone: String(values.get("recipientPhone") || "").trim(),
      recipientEmail: String(values.get("recipientEmail") || "").trim(),
    };
    setBusy(true);
    setRequestFormError("");
    try {
      const idempotencyKey = pendingDraft
        ? undefined
        : ensureDraftCreationKey();
      const draft = await saveRequest(
        pendingDraft ? { ...input, versionNo: pendingDraft.versionNo } : input,
        pendingDraft?.id,
        idempotencyKey,
      );
      if (idempotencyKey) clearDraftCreationKey();
      setPendingDraft({
        id: draft.id,
        versionNo: draft.versionNo,
        status: draft.status,
        reviewReason: draft.reviewReason,
        input,
      });
      setCreateOpen(false);
      notify("Draft saved. You can continue it from the request list.");
      await reload();
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.errors.length || error.status === 400 || error.status === 422)
      ) {
        const mapped: Record<string, string> = {};
        for (const item of error.errors) {
          const field = item.field?.replace(/^\w+\./, "").toLowerCase();
          if (field) mapped[field] = item.message;
        }
        if (
          !Object.keys(mapped).length &&
          /departure|lead.time/i.test(error.message)
        )
          mapped.requesteddepartureat = error.message;
        if (Object.keys(mapped).length) {
          setRequestFieldErrors(mapped);
          setRequestFormError("");
        } else setRequestFormError(errorText(error));
      } else setRequestFormError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  function ensureDraftCreationKey() {
    const key = draftCreationKey || crypto.randomUUID();
    sessionStorage.setItem("equroute.draftCreationKey", key);
    setDraftCreationKey(key);
    return key;
  }
  function clearDraftCreationKey() {
    sessionStorage.removeItem("equroute.draftCreationKey");
    setDraftCreationKey("");
  }
  async function resumeRequestDraft(id: string) {
    try {
      const draft = await getRequest(id);
      const input = {
        originLocationId: draft.originLocationId ?? "",
        destinationLocationId: draft.destinationLocationId ?? "",
        customPickupLatitude: draft.customPickupLatitude,
        customPickupLongitude: draft.customPickupLongitude,
        customPickupLabel: draft.customPickupLabel,
        requestedDepartureAt: draft.requestedDepartureAt,
        preferredTransportMode: draft.preferredTransportMode ?? "ROAD",
        deliveryPriority: draft.deliveryPriority ?? "STANDARD",
        notes: draft.notes ?? "",
        horseIds: draft.horseIds,
        recipientIsRequester: draft.recipientIsRequester ?? false,
        recipientName: draft.recipientName ?? "",
        recipientPhone: draft.recipientPhone ?? "",
        recipientEmail: draft.recipientEmail ?? "",
      };
      const needsUpdate = draft.status.toUpperCase() === "NEED_INFORMATION";
      setPendingDraft({
        id: draft.id,
        versionNo: draft.versionNo,
        status: draft.status,
        reviewReason: draft.reviewReason,
        input,
      });
      setOriginLocationId(input.originLocationId);
      setDestinationLocationId(input.destinationLocationId);
      setCustomPickup(
        input.customPickupLatitude != null &&
          input.customPickupLongitude != null
          ? {
              point: {
                latitude: input.customPickupLatitude,
                longitude: input.customPickupLongitude,
              },
              label: input.customPickupLabel,
            }
          : null,
      );
      setNearestReceiving(
        locations.find((location) => location.id === input.originLocationId) ??
          null,
      );
      setDeparturePreview(toLocalDateTime(input.requestedDepartureAt));
      setModePreview(input.preferredTransportMode);
      setPriorityPreview(input.deliveryPriority);
      setRecipientIsRequester(input.recipientIsRequester);
      setRecipientName(input.recipientName ?? "");
      setRecipientPhone(input.recipientPhone ?? "");
      setRecipientEmail(input.recipientEmail ?? "");
      setRequestHorseIds(input.horseIds);
      setRequestFieldErrors({});
      setRequestFormError("");
      setUploadFiles({});
      setUploadExpiry({});
      if (needsUpdate) {
        const [checklist, types] = await Promise.all([
          getRequestDocumentChecklist(draft.id),
          getDocumentTypes(),
        ]);
        let estimate: RouteCapabilities | null = null;
        if (input.originLocationId && input.destinationLocationId) {
          try {
            estimate = await getRouteCapabilities(
              input.originLocationId,
              input.destinationLocationId,
            );
          } catch {
            estimate = null;
          }
        }
        setRouteCapabilities(estimate);
        setDocumentChecklist(checklist);
        setRequiredDocumentTypes(types);
        setRequestSummary({
          departure: new Date(input.requestedDepartureAt).toLocaleString(),
          arrival: estimatedArrivalWindow(
            estimate,
            input.preferredTransportMode,
            toLocalDateTime(input.requestedDepartureAt),
            input.deliveryPriority,
          ),
          mode: input.preferredTransportMode,
          priority: input.deliveryPriority,
          notes: input.notes,
        });
        setRequestStep(2);
      } else {
        setRequestStep(0);
      }
      setCreateOpen(true);
    } catch (error) {
      report(errorText(error));
    }
  }
  async function confirmCancellation() {
    if (!selectedRequest || cancelBusy) return;
    setCancelBusy(true);
    setCancelError("");
    try {
      if (selectedRequest.status === "APPROVED" && selectedRequest.orderId)
        await cancelOrder(selectedRequest.orderId, cancelReason.trim());
      else await cancelRequest(selectedRequest.id, cancelReason.trim());
      const refreshed = await getRequest(selectedRequest.id);
      setSelectedRequest(refreshed);
      setRequestHistory(await getRequestHistory(selectedRequest.id));
      setCancelOpen(false);
      setCancelReason("");
      notify("Transport request cancelled.");
      await reload();
    } catch (error) {
      setCancelError(errorText(error));
    } finally {
      setCancelBusy(false);
    }
  }
  async function uploadRequiredDocument(
    horseId: string,
    documentTypeCode: string,
  ) {
    if (!pendingDraft) return;
    const key = `${horseId}:${documentTypeCode}`;
    const file = uploadFiles[key];
    const type = requiredDocumentTypes.find(
      (item) => item.code === documentTypeCode,
    );
    if (!file || !type) {
      setRequestFormError("Choose a document file for this requirement.");
      return;
    }
    if (!uploadExpiry[key]) {
      setRequestFormError(
        "Enter the expiry date shown on the document before uploading it.",
      );
      return;
    }
    const payload = new FormData();
    payload.set("file", file);
    payload.set("documentTypeId", type.id);
    payload.set("horseId", horseId);
    payload.set("requestId", pendingDraft.id);
    if (uploadExpiry[key]) payload.set("expiryDate", uploadExpiry[key]);
    setUploadingKey(key);
    setRequestFormError("");
    try {
      await uploadDocumentFile(payload);
      setDocumentChecklist(await getRequestDocumentChecklist(pendingDraft.id));
      notify("Document uploaded for review.");
    } catch (error) {
      setRequestFormError(errorText(error));
    } finally {
      setUploadingKey("");
    }
  }
  async function createRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const departureValue = String(f.get("requestedDepartureAt") || "");
    const departure = new Date(departureValue);
    setRequestFormError("");
    setRequestFieldErrors({});
    report("");
    const fieldErrors: Record<string, string> = {};
    if (!originLocationId)
      fieldErrors.originlocationid = "Choose a pickup location.";
    if (!destinationLocationId)
      fieldErrors.destinationlocationid = "Choose a delivery location.";
    if (originLocationId && originLocationId === destinationLocationId)
      fieldErrors.destinationlocationid =
        "Pickup and delivery locations must be different.";
    if (!requestHorseIds.length)
      fieldErrors.horseids = "Select at least one horse.";
    if (
      requestHorseIds.some(
        (id) =>
          !horseAvailability?.find((item) => item.horseId === id)?.eligible,
      )
    )
      fieldErrors.horseids =
        "Remove horses that are not available for transport.";
    if (!recipientIsRequester) {
      if (!recipientName.trim())
        fieldErrors.recipientname = "Enter the recipient name.";
      if (!recipientPhone.trim())
        fieldErrors.recipientphone = "Enter the recipient phone number.";
      if (
        !recipientEmail.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())
      )
        fieldErrors.recipientemail = "Enter a valid recipient email address.";
    }
    if (
      !routeCapabilities?.allowedModes.includes(
        String(f.get("preferredTransportMode") || ""),
      )
    )
      fieldErrors.preferredtransportmode =
        "Choose a mode available for this route.";
    const departureError = departureValidationMessage(
      departureValue,
      bookingLeadTime,
    );
    if (departureError) fieldErrors.requesteddepartureat = departureError;
    if (Object.keys(fieldErrors).length) {
      setRequestFieldErrors(fieldErrors);
      return;
    }
    const input = {
      originLocationId,
      destinationLocationId,
      customPickupLatitude: customPickup?.point.latitude,
      customPickupLongitude: customPickup?.point.longitude,
      customPickupLabel: customPickup?.label,
      requestedDepartureAt: departure.toISOString(),
      preferredTransportMode: String(f.get("preferredTransportMode") || ""),
      deliveryPriority: String(f.get("deliveryPriority") || "STANDARD") as
        | "STANDARD"
        | "EXPRESS",
      notes: String(f.get("notes") || ""),
      horseIds: requestHorseIds,
      recipientIsRequester: f.get("recipientIsRequester") === "true",
      recipientName: String(f.get("recipientName") || "").trim(),
      recipientPhone: String(f.get("recipientPhone") || "").trim(),
      recipientEmail: String(f.get("recipientEmail") || "").trim(),
    };
    setBusy(true);
    try {
      let requestId: string;
      if (pendingDraft) {
        const updated = await saveRequest(
          { ...input, versionNo: pendingDraft.versionNo },
          pendingDraft.id,
        );
        requestId = updated.id;
        setPendingDraft({
          id: updated.id,
          versionNo: updated.versionNo,
          status: updated.status,
          reviewReason: updated.reviewReason,
          input,
        });
      } else {
        const key = ensureDraftCreationKey();
        const draft = await saveRequest(input, undefined, key);
        clearDraftCreationKey();
        requestId = draft.id;
        setPendingDraft({
          id: draft.id,
          versionNo: draft.versionNo,
          status: draft.status,
          reviewReason: draft.reviewReason,
          input,
        });
      }
      const submittedRequest = await submitRequest(requestId);
      setPendingDraft(null);
      form.reset();
      setRequestHorseIds([]);
      setOriginLocationId("");
      setDestinationLocationId("");
      setCustomPickup(null);
      setNearestReceiving(null);
      setNearestReceivingDistance(null);
      setCreateOpen(false);
      setRequestFormError("");
      setRequestFieldErrors({});
      setRequestSuccess({
        id: submittedRequest.id || requestId,
        requestNo: submittedRequest.requestNo || requestId,
      });
      await reload();
    } catch (e) {
      if (
        e instanceof ApiError &&
        (e.errors.length || e.status === 400 || e.status === 422)
      ) {
        const mapped: Record<string, string> = {};
        for (const error of e.errors) {
          const field = error.field?.replace(/^\w+\./, "").toLowerCase();
          if (field) mapped[field] = error.message;
        }
        if (
          !Object.keys(mapped).length &&
          /departure|lead.time/i.test(e.message)
        )
          mapped.requesteddepartureat = e.message;
        setRequestFieldErrors(mapped);
        setRequestFormError(
          Object.keys(mapped).some((field) =>
            [
              "originlocationid",
              "destinationlocationid",
              "requesteddepartureat",
              "requestedarrivalat",
              "horseids",
              "preferredtransportmode",
            ].includes(field),
          )
            ? ""
            : errorText(e),
        );
      } else setRequestFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const clearRequestFieldError = (field: string) =>
    setRequestFieldErrors((current) => {
      const next = { ...current };
      delete next[field.toLowerCase()];
      return next;
    });
  async function advanceRequestStep(form: HTMLFormElement | null) {
    if (!form) return;
    const errors: Record<string, string> = {};
    if (requestStep === 0) {
      if (!originLocationId)
        errors.originlocationid = "Choose a pickup location.";
      if (!destinationLocationId)
        errors.destinationlocationid = "Choose a delivery location.";
      if (originLocationId && originLocationId === destinationLocationId)
        errors.destinationlocationid = "Choose a different delivery location.";
      if (
        originLocationId &&
        destinationLocationId &&
        originLocationId !== destinationLocationId &&
        !routeCapabilities?.configured
      )
        errors.destinationlocationid =
          "Transport is not available for this route yet.";
    } else {
      const values = new FormData(form);
      const departure = new Date(
        String(values.get("requestedDepartureAt") || ""),
      );
      const mode = String(values.get("preferredTransportMode") || "");
      if (!requestHorseIds.length)
        errors.horseids = "Select at least one available horse.";
      if (
        requestHorseIds.some(
          (id) =>
            !horseAvailability?.find((item) => item.horseId === id)?.eligible,
        )
      )
        errors.horseids = "Remove horses that are not available for transport.";
      const departureError = departureValidationMessage(
        String(values.get("requestedDepartureAt") || ""),
        bookingLeadTime,
      );
      if (departureError) errors.requesteddepartureat = departureError;
      if (!routeCapabilities?.allowedModes.includes(mode))
        errors.preferredtransportmode = "Choose an available transport mode.";
      const priority = String(values.get("deliveryPriority") || "STANDARD");
      if (
        priority === "EXPRESS" &&
        !routeCapabilities?.estimatedDurations.find(
          (item) => item.mode === mode,
        )?.minExpressDurationMinutes
      )
        errors.deliverypriority =
          "Express delivery is not configured for this route and mode.";
      if (!Object.keys(errors).length)
        setRequestSummary({
          departure: departure.toLocaleString(),
          arrival: estimatedArrivalWindow(
            routeCapabilities,
            mode,
            String(values.get("requestedDepartureAt") || ""),
            priority,
          ),
          mode: String(values.get("preferredTransportMode") || "ROAD"),
          priority,
          notes: String(values.get("notes") || ""),
        });
    }
    setRequestFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (requestStep === 0) {
      setRequestStep(1);
      return;
    }
    const values = new FormData(form);
    const input = {
      originLocationId,
      destinationLocationId,
      requestedDepartureAt: new Date(
        String(values.get("requestedDepartureAt")),
      ).toISOString(),
      preferredTransportMode: String(
        values.get("preferredTransportMode") || "",
      ),
      deliveryPriority: String(values.get("deliveryPriority") || "STANDARD") as
        | "STANDARD"
        | "EXPRESS",
      notes: String(values.get("notes") || ""),
      horseIds: requestHorseIds,
      recipientIsRequester: values.get("recipientIsRequester") === "true",
      recipientName: String(values.get("recipientName") || "").trim(),
      recipientPhone: String(values.get("recipientPhone") || "").trim(),
      recipientEmail: String(values.get("recipientEmail") || "").trim(),
    };
    setBusy(true);
    setRequestFormError("");
    try {
      const idempotencyKey = pendingDraft
        ? undefined
        : ensureDraftCreationKey();
      const draft = await saveRequest(
        pendingDraft ? { ...input, versionNo: pendingDraft.versionNo } : input,
        pendingDraft?.id,
        idempotencyKey,
      );
      if (idempotencyKey) clearDraftCreationKey();
      setPendingDraft({
        id: draft.id,
        versionNo: draft.versionNo,
        status: draft.status,
        reviewReason: draft.reviewReason,
        input,
      });
      const [checklist, types] = await Promise.all([
        getRequestDocumentChecklist(draft.id),
        getDocumentTypes(),
      ]);
      await reload();
      setDocumentChecklist(checklist);
      setRequiredDocumentTypes(types);
      setRequestStep(2);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.errors.length || error.status === 400 || error.status === 422)
      ) {
        const mapped: Record<string, string> = {};
        for (const item of error.errors) {
          const field = item.field?.replace(/^\w+\./, "").toLowerCase();
          if (field) mapped[field] = item.message;
        }
        if (
          !Object.keys(mapped).length &&
          /departure|lead.time/i.test(error.message)
        )
          mapped.requesteddepartureat = error.message;
        if (Object.keys(mapped).length) {
          setRequestFieldErrors(mapped);
          setRequestFormError("");
        } else setRequestFormError(errorText(error));
      } else setRequestFormError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  if (section === "horses")
    return (
      <div className="stack">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>My horses</h2>
              <p>
                Register and manage horses available for transport requests.
              </p>
            </div>
            <div className="header-actions">
              <span className="result-count">
                {horsePagination.totalItems} registered
              </span>
              <button onClick={() => setCreateOpen(true)}>
                + Register horse
              </button>
            </div>
          </div>
          <ListFilters
            query={horseQuery}
            status={horseStatus}
            statuses={["ACTIVE", "INACTIVE", "RETIRED"]}
            placeholder="Name, code, registration or passport…"
            onQueryChange={setHorseQuery}
            onStatusChange={(value) => {
              setHorseStatus(value);
              setHorsePagination((p) => ({ ...p, page: 0 }));
            }}
            onSearch={() => {
              setHorseSearch(horseQuery.trim());
              setHorsePagination((p) => ({ ...p, page: 0 }));
            }}
            onClear={() => {
              setHorseQuery("");
              setHorseSearch("");
              setHorseStatus("");
              setHorsePagination((p) => ({ ...p, page: 0 }));
            }}
          />
          <div className="table-tools">
            <label>
              Sort by
              <select
                value={horseSortBy}
                onChange={(event) => {
                  setHorseSortBy(event.target.value as "name" | "status");
                  setHorsePagination((p) => ({ ...p, page: 0 }));
                }}
              >
                <option value="name">Name</option>
                <option value="status">Status</option>
              </select>
            </label>
            <label>
              Direction
              <select
                value={horseSortDirection}
                onChange={(event) => {
                  setHorseSortDirection(event.target.value as "asc" | "desc");
                  setHorsePagination((p) => ({ ...p, page: 0 }));
                }}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
            <small className="field-help">
              Sorted across all matching horses.
            </small>
          </div>
          <div className="assignment-list">
            {horses.map((h) => (
              <div className="assignment-row" key={h.id}>
                <button
                  className="horse-details-trigger"
                  onClick={() => void openHorseDetails(h.id)}
                  disabled={horseDetailLoading}
                >
                  <b>{h.horseName}</b>
                  <small>
                    {h.horseCode} · {h.status}
                    {h.breed ? ` · ${h.breed}` : ""}
                  </small>
                </button>
                <button
                  className="danger small"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `Remove ${h.horseName} from your horse registry?`,
                      )
                    )
                      return;
                    report("");
                    try {
                      await deleteHorse(h.id);
                      if (horses.length === 1 && horsePagination.page > 0)
                        setHorsePagination((p) => ({ ...p, page: p.page - 1 }));
                      else await reload();
                      report("");
                      notify("Horse removed.");
                    } catch (e) {
                      report(errorText(e));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
            {!horses.length && (
              <div className="empty-state">
                No horses match the current filters.
              </div>
            )}
          </div>
          <Pagination
            value={horsePagination}
            onChange={(page, pageSize) =>
              setHorsePagination((p) => ({ ...p, page, pageSize }))
            }
          />
        </section>
        {selectedHorse && (
          <ActionModal
            title={selectedHorse.horseName}
            description={`${selectedHorse.horseCode} · ${selectedHorse.status}`}
            onClose={() => setSelectedHorse(null)}
          >
            <div className="detail-grid">
              {[
                ["Registration no.", selectedHorse.registrationNumber],
                ["Passport no.", selectedHorse.passportNumber],
                ["Breed", selectedHorse.breed],
                ["Sex", selectedHorse.sex],
                [
                  "Date of birth",
                  selectedHorse.dateOfBirth
                    ? new Date(
                        `${selectedHorse.dateOfBirth}T00:00:00`,
                      ).toLocaleDateString()
                    : "—",
                ],
                ["Color", selectedHorse.color],
                [
                  "Country of origin",
                  selectedHorse.countryOfOriginName ??
                    (selectedHorse.countryOfOriginId
                      ? "Country name unavailable"
                      : undefined),
                ],
                ["Special requirements", selectedHorse.specialRequirements],
                ["Record version", String(selectedHorse.versionNo)],
              ].map(([label, value]) => (
                <div className="detail-field" key={label}>
                  <small>{label}</small>
                  <b>{value || "—"}</b>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setSelectedHorse(null)}>
                Close
              </button>
            </div>
          </ActionModal>
        )}
        {createOpen && (
          <ActionModal
            title="Register a horse"
            description="Add identity and care details before booking transport."
            onClose={() => setCreateOpen(false)}
          >
            <form className="form-grid" onSubmit={createHorse}>
              <label>
                Horse name
                <input
                  name="horseName"
                  placeholder="e.g. Thunder Bay"
                  autoFocus
                  required
                />
              </label>
              <label>
                Registration no.
                <input
                  name="registrationNumber"
                  placeholder="e.g. VN-RH-2026-001"
                />
              </label>
              <label>
                Passport no.
                <input name="passportNumber" placeholder="e.g. HPA-123456" />
              </label>
              <label>
                Breed
                <input name="breed" placeholder="e.g. Thoroughbred" />
              </label>
              <label>
                Sex
                <input
                  name="sex"
                  placeholder="e.g. Mare, stallion or gelding"
                />
              </label>
              <label>
                Date of birth
                <input
                  name="dateOfBirth"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <label>
                Color
                <input name="color" placeholder="e.g. Bay" />
              </label>
              <label>
                Country of origin
                <select
                  name="countryIsoCode"
                  defaultValue=""
                  disabled={
                    externalCountriesLoading || !externalCountries.length
                  }
                >
                  <option value="">
                    {externalCountriesLoading
                      ? "Loading countries…"
                      : externalCountries.length
                        ? "Choose a country (optional)"
                        : "Country list unavailable"}
                  </option>
                  {externalCountries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {externalCountriesError ? (
                  <small className="auth-error" role="alert">
                    Could not load countries from CountriesNow:{" "}
                    {externalCountriesError}{" "}
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => void loadExternalCountries()}
                    >
                      Retry
                    </button>
                  </small>
                ) : !externalCountries.length ? (
                  <small className="field-help">
                    Loading the country list…
                  </small>
                ) : null}
              </label>
              <label className="span-2">
                Special requirements
                <input
                  name="specialRequirements"
                  placeholder="e.g. Temperature control, extra rest stops"
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button disabled={busy}>
                  {busy ? "Registering…" : "Register horse"}
                </button>
              </div>
            </form>
          </ActionModal>
        )}
      </div>
    );
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Transport requests</h2>
            <p>Track drafts and requests sent for review.</p>
          </div>
          <div className="header-actions">
            <button className="ghost" onClick={() => void reload()}>
              Refresh
            </button>
            <button
              disabled={
                !horses.some((horse) => horse.status === "ACTIVE") ||
                !locations.length
              }
              onClick={() => {
                setRequestFormError("");
                setRequestFieldErrors({});
                setRequestStep(0);
                setPendingDraft(null);
                setDocumentChecklist(null);
                report("");
                setRequestHorseIds([]);
                setOriginLocationId("");
                setDestinationLocationId("");
                setCustomPickup(null);
                setNearestReceiving(null);
                setNearestReceivingDistance(null);
                setDeparturePreview("");
                setModePreview("");
                setPriorityPreview("STANDARD");
                setRecipientIsRequester(false);
                setRecipientName("");
                setRecipientPhone("");
                setRecipientEmail("");
                setMapLocationTarget("pickup");
                setCreateOpen(true);
              }}
            >
              + New request
            </button>
          </div>
        </div>
        {!horses.length && (
          <p className="form-hint">
            Register at least one horse before creating a request.
          </p>
        )}
        {!locations.length && (
          <p className="form-hint">
            No active pickup or destination locations are available yet. Ask
            Logistics to register the locations first.
          </p>
        )}
        <ListFilters
          query={requestQuery}
          status={requestStatus}
          statuses={[
            "DRAFT",
            "SUBMITTED",
            "UNDER_REVIEW",
            "NEED_INFORMATION",
            "APPROVED",
            "REJECTED",
            "CANCELLED",
          ]}
          placeholder="Search horse name…"
          onQueryChange={setRequestQuery}
          onStatusChange={(value) => {
            setRequestStatus(value);
            setRequestPagination((p) => ({ ...p, page: 0 }));
          }}
          onSearch={() => {
            setRequestSearch(requestQuery.trim());
            setRequestPagination((p) => ({ ...p, page: 0 }));
          }}
          onClear={() => {
            setRequestQuery("");
            setRequestSearch("");
            setRequestStatus("");
            setRequestPagination((p) => ({ ...p, page: 0 }));
          }}
        />
        <div className="table-tools">
          <label>
            Sort by
            <select
              value={requestSortBy}
              onChange={(event) => {
                setRequestSortBy(event.target.value as "departure" | "request");
                setRequestPagination((p) => ({ ...p, page: 0 }));
              }}
            >
              <option value="departure">Departure</option>
              <option value="request">Request number</option>
            </select>
          </label>
          <label>
            Direction
            <select
              value={requestSortDirection}
              onChange={(event) => {
                setRequestSortDirection(event.target.value as "asc" | "desc");
                setRequestPagination((p) => ({ ...p, page: 0 }));
              }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <small className="field-help">
            Sorted across all matching requests.
          </small>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Horse(s)</th>
                <th>Created</th>
                <th>Status</th>
                <th>Departure</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      className="ghost small"
                      title={r.horseNames || `${r.horseCount} horse(s)`}
                      onClick={() => void openRequestDetails(r.id)}
                    >
                      {requestHorseLabel(r.horseNames, r.horseCount)}
                    </button>
                  </td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <StatusBadge
                      value={r.status}
                      label={requestStatusLabel(r.status)}
                    />
                  </td>
                  <td>{new Date(r.requestedDepartureAt).toLocaleString()}</td>
                  <td>
                    {r.status.toUpperCase() === "DRAFT" ? (
                      <button
                        className="ghost small"
                        onClick={() => void resumeRequestDraft(r.id)}
                      >
                        Continue draft
                      </button>
                    ) : r.status.toUpperCase() === "NEED_INFORMATION" ? (
                      <button
                        className="ghost small"
                        onClick={() => void resumeRequestDraft(r.id)}
                      >
                        Update & resubmit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!requests.length && (
                <tr>
                  <td colSpan={5}>No requests match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          value={requestPagination}
          onChange={(page, pageSize) =>
            setRequestPagination((p) => ({ ...p, page, pageSize }))
          }
        />
      </section>
      {selectedRequest && (
        <ActionModal
          title={selectedRequest.requestNo}
          description={`Transport request · ${requestStatusLabel(selectedRequest.status)}`}
          onClose={() => setSelectedRequest(null)}
        >
          <div className="detail-grid">
            {[
              ["Status", selectedRequest.status],
              [
                "Pickup",
                locations.find(
                  (location) =>
                    location.id === selectedRequest.originLocationId,
                )?.name ?? "—",
              ],
              [
                "Customer collection",
                selectedRequest.customPickupLabel ||
                  (selectedRequest.customPickupLatitude != null
                    ? `GPS ${selectedRequest.customPickupLatitude.toFixed(6)}, ${selectedRequest.customPickupLongitude?.toFixed(6)}`
                    : "Not requested"),
              ],
              [
                "Delivery",
                locations.find(
                  (location) =>
                    location.id === selectedRequest.destinationLocationId,
                )?.name ?? "—",
              ],
              [
                "Departure",
                new Date(selectedRequest.requestedDepartureAt).toLocaleString(),
              ],
              [
                "Estimated arrival",
                selectedRequest.requestedArrivalAt
                  ? new Date(
                      selectedRequest.requestedArrivalAt,
                    ).toLocaleString()
                  : estimatedArrivalWindow(
                      selectedEstimate,
                      selectedRequest.preferredTransportMode ?? "",
                      selectedRequest.requestedDepartureAt,
                      selectedRequest.deliveryPriority ?? "STANDARD",
                    ),
              ],
              ["Transport mode", selectedRequest.preferredTransportMode ?? "—"],
              [
                "Delivery priority",
                selectedRequest.deliveryPriority ?? "STANDARD",
              ],
              [
                "Horses",
                selectedRequest.horses
                  ?.map((horse) => `${horse.horseName} · ${horse.horseCode}`)
                  .join(", ") ?? selectedRequest.horseIds.join(", "),
              ],
              [
                "Recipient",
                selectedRequest.recipientIsRequester
                  ? "Requester / account holder"
                  : [
                      selectedRequest.recipientName,
                      selectedRequest.recipientPhone,
                      selectedRequest.recipientEmail,
                    ]
                      .filter(Boolean)
                      .join(" · "),
              ],
              ["Notes", selectedRequest.notes ?? "—"],
              [
                "Review decision",
                selectedRequest.reviewReason ?? "No decision note",
              ],
            ].map(([label, value]) => (
              <div className="detail-field" key={label}>
                <small>{label}</small>
                <b>{value || "—"}</b>
              </div>
            ))}
          </div>
          {selectedRequest.status === "APPROVED" && selectedRequest.orderId && (
            <section className="notice-card request-payment-summary">
              <div className="panel-title">
                <div>
                  <h3>Transport payment</h3>
                  <p>
                    Payment is required before Logistics can place this order
                    on a trip.
                  </p>
                </div>
                {selectedRequest.orderNo && (
                  <span className="result-count">{selectedRequest.orderNo}</span>
                )}
              </div>
              {requestPaymentLoading ? (
                <p className="field-help">Loading payment invoice…</p>
              ) : requestPayment ? (
                <div className="payment-summary">
                  <div>
                    <small>{requestPayment.invoiceNo}</small>
                    <strong>
                      {requestPayment.amount.toLocaleString()} {requestPayment.currencyCode}
                    </strong>
                    <span>
                      {requestPayment.status.replaceAll("_", " ")}
                      {requestPayment.paidAt
                        ? ` · Paid ${new Date(requestPayment.paidAt).toLocaleString()}`
                        : ""}
                    </span>
                  </div>
                  {requestPayment.status === "PENDING_PAYMENT" && (
                    <button
                      type="button"
                      disabled={requestPaymentBusy}
                      onClick={() => void startRequestPayment()}
                    >
                      {requestPaymentBusy ? "Opening payment…" : "Pay with PayOS"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="field-help">
                  No invoice was created for this order. Ask the administrator
                  to activate a pricing rule for this route, transport mode,
                  and priority, then approve a new request.
                </p>
              )}
            </section>
          )}
          <h3>Attached documents</h3>
          {customerRequestDocumentsLoading ? (
            <p>Loading document status…</p>
          ) : customerRequestDocuments.length ? (
            <ul>
              {customerRequestDocuments.map((document) => (
                <li key={document.id}>
                  {document.documentTypeName || document.documentNo} ·{" "}
                  <em>{document.status}</em>
                  {document.expiryDate
                    ? ` · Expires ${new Date(document.expiryDate).toLocaleDateString()}`
                    : ""}{" "}
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => void openSecureDocument(document, report)}
                  >
                    Open file
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No documents attached to this request or its horses.</p>
          )}
          <h3>Status history</h3>
          {requestHistoryLoading ? (
            <p>Loading status history…</p>
          ) : (
            <div className="timeline">
              {[
                {
                  id: `created-${selectedRequest.id}`,
                  action: "Request created",
                  newState: "DRAFT",
                  actorUserId: selectedRequest.createdByUserId,
                  occurredAt: selectedRequest.createdAt,
                },
                ...requestHistory,
              ].map((event) => (
                <article className="timeline-event" key={event.id}>
                  <b>{event.action}</b>
                  <small>
                    {formatDateTime(event.occurredAt)} ·{" "}
                    {event.actorUserId === selectedRequest.createdByUserId
                      ? "You"
                      : (requestActorNames[event.actorUserId] ??
                        "Operations team")}
                  </small>
                  <p>
                    {event.oldState
                      ? `${event.oldState} → ${event.newState}`
                      : event.newState || "—"}
                    {event.reason ? ` · ${event.reason}` : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
          <section className="notice-card request-journey-link">
            <h3>Journey & delivery</h3>
            <p>
              Follow the transport order, trip progress, horse health updates,
              incidents, and handover from the dedicated journey workspace.
            </p>
            <button
              type="button"
              className="ghost small"
              onClick={onOpenJourney}
            >
              Open Journey & delivery
            </button>
          </section>
          {[
            "DRAFT",
            "SUBMITTED",
            "UNDER_REVIEW",
            "NEED_INFORMATION",
          ].includes(selectedRequest.status) && (
            <section className="span-2">
              <h3>Cancel this request</h3>
              <p className="field-help">
                Cancellation is available while this request is awaiting a decision.
                Approved transport requests cannot be cancelled by the customer.
              </p>
              {cancelOpen ? (
                <>
                  <label>
                    Reason (optional)
                    <textarea
                      value={cancelReason}
                      maxLength={1000}
                      onChange={(event) => setCancelReason(event.target.value)}
                      rows={2}
                    />
                  </label>
                  {cancelError && (
                    <p className="auth-error" role="alert">
                      {cancelError}
                    </p>
                  )}
                  <div className="modal-actions">
                    <button
                      className="ghost"
                      onClick={() => setCancelOpen(false)}
                    >
                      Keep request
                    </button>
                    <button
                      className="danger"
                      disabled={cancelBusy}
                      onClick={() => void confirmCancellation()}
                    >
                      {cancelBusy ? "Cancelling…" : "Confirm cancellation"}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="ghost"
                  onClick={() => {
                    setCancelOpen(true);
                    setCancelError("");
                  }}
                >
                  Cancel request
                </button>
              )}
            </section>
          )}
          <div className="modal-actions">
            <button
              className="ghost"
              onClick={() => {
                setSelectedRequest(null);
                setCancelOpen(false);
              }}
            >
              Close
            </button>
          </div>
        </ActionModal>
      )}
      {createOpen && (
        <ActionModal
          title="New transport request"
          description="Choose the registered pickup and delivery sites. If needed, set where the driver should collect the horse; the nearest registered pickup is selected automatically."
          onClose={() => setCreateOpen(false)}
          className="request-create-modal"
        >
          <form
            className="form-grid request-form"
            noValidate
            onSubmit={createRequest}
          >
            <p className="field-help span-2" role="status">
              Step {requestStep + 1} of 3 · {requestsSteps[requestStep]}
            </p>
            {pendingDraft?.status?.toUpperCase() === "NEED_INFORMATION" && (
              <div className="notice-card span-2">
                <b>Changes requested by Logistics</b>
                <p>
                  {pendingDraft.reviewReason ||
                    "Review the request and update the requested information before resubmitting."}
                </p>
              </div>
            )}
            {requestFormError && (
              <p className="auth-error span-2" role="alert">
                {requestFormError}
              </p>
            )}
            <div
              className="form-grid request-step span-2"
              style={{ display: requestStep === 0 ? "grid" : "none" }}
            >
              <label>
                Pickup address
                <select
                  aria-invalid={!!requestFieldErrors.originlocationid}
                  aria-describedby={
                    requestFieldErrors.originlocationid
                      ? "originLocationId-error"
                      : undefined
                  }
                  name="originLocationId"
                  autoFocus
                  required
                  value={originLocationId}
                  onFocus={() => {
                    setMapLocationTarget("pickup");
                    setMapFocusVersion((value) => value + 1);
                  }}
                  onChange={(event) => {
                    const id = event.target.value;
                    customPickupLookupId.current += 1;
                    setNearestReceivingLoading(false);
                    setRequestFormError("");
                    setOriginLocationId(id);
                    setMapLocationTarget("pickup");
                    setMapFocusVersion((value) => value + 1);
                    const site = locations.find(
                      (location) => location.id === id,
                    );
                    if (
                      customPickup &&
                      site?.latitude != null &&
                      site.longitude != null
                    ) {
                      setNearestReceiving(site);
                      setNearestReceivingDistance(
                        straightLineDistanceKm(customPickup.point, {
                          latitude: Number(site.latitude),
                          longitude: Number(site.longitude),
                        }),
                      );
                    } else {
                      setNearestReceiving(null);
                      setNearestReceivingDistance(null);
                      setPickupRoadDistance({
                        km: null,
                        status: "unavailable",
                      });
                    }
                    clearRequestFieldError("originLocationId");
                    clearRequestFieldError("destinationLocationId");
                  }}
                >
                  <option value="" disabled>
                    Select a saved location
                  </option>
                  {locations.map((location) => (
                    <option
                      key={location.id}
                      value={location.id}
                      disabled={location.id === destinationLocationId}
                    >
                      {location.name}
                      {location.address ? ` · ${location.address}` : ""}
                      {location.city ? `, ${location.city}` : ""}
                    </option>
                  ))}
                </select>
                {requestFieldErrors.originlocationid && (
                  <small
                    className="auth-error"
                    id="originLocationId-error"
                    role="alert"
                  >
                    {requestFieldErrors.originlocationid}
                  </small>
                )}
              </label>
              <label>
                Delivery address
                <select
                  aria-invalid={!!requestFieldErrors.destinationlocationid}
                  aria-describedby={
                    requestFieldErrors.destinationlocationid
                      ? "destinationLocationId-error"
                      : undefined
                  }
                  name="destinationLocationId"
                  required
                  value={destinationLocationId}
                  onFocus={() => {
                    setMapLocationTarget("delivery");
                    setMapFocusVersion((value) => value + 1);
                  }}
                  onChange={(event) => {
                    setRequestFormError("");
                    setDestinationLocationId(event.target.value);
                    setMapLocationTarget("delivery");
                    setMapFocusVersion((value) => value + 1);
                    clearRequestFieldError("destinationLocationId");
                    clearRequestFieldError("originLocationId");
                  }}
                >
                  <option value="" disabled>
                    Select a saved location
                  </option>
                  {locations.map((location) => (
                    <option
                      key={location.id}
                      value={location.id}
                      disabled={location.id === originLocationId}
                    >
                      {location.name}
                      {location.address ? ` · ${location.address}` : ""}
                      {location.city ? `, ${location.city}` : ""}
                    </option>
                  ))}
                </select>
                {requestFieldErrors.destinationlocationid && (
                  <small
                    className="auth-error"
                    id="destinationLocationId-error"
                    role="alert"
                  >
                    {requestFieldErrors.destinationlocationid}
                  </small>
                )}
              </label>
              <p className="location-help span-2">
                {originLocationId && (
                  <a
                    href={osmSearchUrl(
                      [
                        locations.find(
                          (location) => location.id === originLocationId,
                        )?.name,
                        locations.find(
                          (location) => location.id === originLocationId,
                        )?.address,
                        locations.find(
                          (location) => location.id === originLocationId,
                        )?.city,
                      ]
                        .filter(Boolean)
                        .join(", "),
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check pickup on OpenStreetMap
                  </a>
                )}
                {originLocationId && destinationLocationId ? " · " : ""}
                {destinationLocationId && (
                  <a
                    href={osmSearchUrl(
                      [
                        locations.find(
                          (location) => location.id === destinationLocationId,
                        )?.name,
                        locations.find(
                          (location) => location.id === destinationLocationId,
                        )?.address,
                        locations.find(
                          (location) => location.id === destinationLocationId,
                        )?.city,
                      ]
                        .filter(Boolean)
                        .join(", "),
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check destination on OpenStreetMap
                  </a>
                )}
                <span>
                  {" "}
                  · © OpenStreetMap contributors. Routing uses the saved site.
                </span>
              </p>
              <p className="field-help span-2" role="status">
                {leadTimeLoading
                  ? "Checking the lead-time rule for this route…"
                  : bookingLeadTime
                    ? `This route requires at least ${bookingLeadTime.minimumLeadTimeDays} days. Earliest departure: ${new Date(bookingLeadTime.earliestDepartureAt).toLocaleString()}.`
                    : "Default booking lead time is at least 5 days; route-specific settings are checked after you select both locations."}
              </p>
              <p className="field-help span-2" role="status">
                {routeCapabilitiesLoading
                  ? "Checking available transport modes…"
                  : routeCapabilities?.configured
                    ? `Available: ${routeCapabilities.allowedModes.join(", ")}`
                    : "No transport service is configured for this pair of locations. Contact Logistics."}
              </p>
              <div className="span-2">
                <OsmPointPicker
                  label="One map · click anywhere to set customer collection; choose Pickup or Delivery above to jump to a saved site"
                  selected={customPickup?.point ?? null}
                  onSelect={(point, place) =>
                    void chooseCustomerPickup(point, place)
                  }
                  onUseCurrentLocation={() => undefined}
                  savedLocations={locations.map((location) => ({
                    id: location.id,
                    name: [location.name, location.city]
                      .filter(Boolean)
                      .join(" · "),
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }))}
                  activeLocationId={
                    mapLocationTarget === "pickup"
                      ? originLocationId
                      : destinationLocationId
                  }
                  selectedLocationIds={[
                    originLocationId,
                    destinationLocationId,
                  ].filter(Boolean)}
                  pickupLocationId={originLocationId}
                  deliveryLocationId={destinationLocationId}
                  focusLocationVersion={mapFocusVersion}
                  pointSelectionEnabled
                  primaryRoute={(() => {
                    const origin = locations.find(
                      (location) => location.id === originLocationId,
                    );
                    const destination = locations.find(
                      (location) => location.id === destinationLocationId,
                    );
                    return origin?.latitude != null &&
                      origin.longitude != null &&
                      destination?.latitude != null &&
                      destination.longitude != null
                      ? {
                          start: {
                            latitude: Number(origin.latitude),
                            longitude: Number(origin.longitude),
                          },
                          end: {
                            latitude: Number(destination.latitude),
                            longitude: Number(destination.longitude),
                          },
                        }
                      : undefined;
                  })()}
                  onRouteDistance={onPickupRouteDistance}
                  routeDestination={
                    customPickup && nearestReceiving
                      ? {
                          point: {
                            latitude: Number(nearestReceiving.latitude),
                            longitude: Number(nearestReceiving.longitude),
                          },
                          label: nearestReceiving.name,
                        }
                      : undefined
                  }
                />
                {nearestReceivingLoading && (
                  <p className="field-help" role="status">
                    Finding the nearest receiving location…
                  </p>
                )}
                {nearestReceiving && customPickup && (
                  <div className="notice-card">
                    <b>Registered Pickup: {nearestReceiving.name}</b>
                    <p>
                      Distance: {nearestReceivingDistance?.toFixed(1)} km
                      straight-line · Road distance:{" "}
                      {pickupRoadDistance.status === "ready"
                        ? pickupRoadDistance.km?.toFixed(1) + " km"
                        : pickupRoadDistance.status === "loading"
                          ? "calculating…"
                          : "unavailable"}
                      .
                    </p>
                    <p>
                      The driver collects the horse at your selected point and
                      brings it here.
                    </p>
                  </div>
                )}
              </div>
              <div className="modal-actions span-2">
                <button
                  type="button"
                  onClick={(event) =>
                    advanceRequestStep(event.currentTarget.form)
                  }
                  disabled={
                    leadTimeLoading ||
                    routeCapabilitiesLoading ||
                    !bookingLeadTime ||
                    !routeCapabilities?.configured
                  }
                >
                  Continue to horses and timing
                </button>
              </div>
            </div>
            <div
              className="form-grid request-step span-2"
              style={{ display: requestStep === 1 ? "grid" : "none" }}
            >
              <label>
                Departure
                <input
                  aria-invalid={!!requestFieldErrors.requesteddepartureat}
                  aria-describedby={
                    requestFieldErrors.requesteddepartureat
                      ? "departure-error"
                      : undefined
                  }
                  name="requestedDepartureAt"
                  defaultValue={
                    pendingDraft
                      ? toLocalDateTime(pendingDraft.input.requestedDepartureAt)
                      : undefined
                  }
                  type="datetime-local"
                  min={
                    bookingLeadTime
                      ? toLocalDateTime(
                          new Date(
                            Math.ceil(
                              new Date(
                                bookingLeadTime.earliestDepartureAt,
                              ).getTime() / 60000,
                            ) * 60000,
                          ).toISOString(),
                        )
                      : localDateTimeAfterDays(5)
                  }
                  required
                  onChange={(event) => {
                    const value = event.target.value;
                    setDeparturePreview(value);
                    const error = departureValidationMessage(
                      value,
                      bookingLeadTime,
                    );
                    setRequestFieldErrors((current) => {
                      const next = { ...current };
                      if (error) next.requesteddepartureat = error;
                      else delete next.requesteddepartureat;
                      return next;
                    });
                  }}
                />
                {requestFieldErrors.requesteddepartureat && (
                  <small
                    className="auth-error"
                    id="departure-error"
                    role="alert"
                  >
                    {requestFieldErrors.requesteddepartureat}
                  </small>
                )}
              </label>
              <p className="field-help span-2">
                The estimated arrival window comes from this route and mode when
                configured. Logistics confirms the final schedule later.
              </p>
              <label>
                Mode
                <select
                  name="preferredTransportMode"
                  defaultValue={
                    pendingDraft?.input.preferredTransportMode ?? ""
                  }
                  aria-invalid={!!requestFieldErrors.preferredtransportmode}
                  onChange={(event) => {
                    const nextMode = event.target.value;
                    setModePreview(nextMode);
                    clearRequestFieldError("preferredTransportMode");
                    if (
                      priorityPreview === "EXPRESS" &&
                      !routeCapabilities?.estimatedDurations.some(
                        (item) =>
                          item.mode === nextMode &&
                          item.minExpressDurationMinutes &&
                          item.maxExpressDurationMinutes,
                      )
                    ) {
                      setPriorityPreview("STANDARD");
                      clearRequestFieldError("deliveryPriority");
                    }
                  }}
                >
                  <option value="">Choose a mode</option>
                  {routeCapabilities?.allowedModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode === "ROAD"
                        ? "Road"
                        : mode === "AIR"
                          ? "Air"
                          : "Road + air"}
                    </option>
                  ))}
                </select>
                {requestFieldErrors.preferredtransportmode && (
                  <small className="auth-error" role="alert">
                    {requestFieldErrors.preferredtransportmode}
                  </small>
                )}
              </label>
              <label>
                Delivery priority
                <select
                  name="deliveryPriority"
                  value={priorityPreview}
                  onChange={(event) => {
                    setPriorityPreview(event.target.value);
                    clearRequestFieldError("deliveryPriority");
                  }}
                >
                  <option value="STANDARD">
                    Standard · configured route estimate
                  </option>
                  {routeCapabilities?.estimatedDurations.some(
                    (item) =>
                      item.mode === modePreview &&
                      item.minExpressDurationMinutes &&
                      item.maxExpressDurationMinutes,
                  ) && (
                    <option value="EXPRESS">
                      Express · configured faster service window
                    </option>
                  )}
                </select>
                {requestFieldErrors.deliverypriority && (
                  <small className="auth-error" role="alert">
                    {requestFieldErrors.deliverypriority}
                  </small>
                )}
                <small className="field-help">
                  Express appears only for route and mode pairs with an approved
                  express time range.
                </small>
              </label>
              <p className="field-help span-2" role="status">
                {estimatedArrivalWindow(
                  routeCapabilities,
                  modePreview,
                  departurePreview,
                  priorityPreview,
                )}
              </p>
              {(!departureIsValid ||
                !selectedModeIsValid ||
                !selectedHorsesAreValid) && (
                <p className="field-help span-2" role="status">
                  To continue, choose an eligible departure time and mode, then
                  select at least one available horse.
                </p>
              )}
              <fieldset
                className="horse-picker span-2"
                aria-describedby={
                  requestFieldErrors.horseids ? "horses-error" : undefined
                }
              >
                <legend>
                  Horses for this request{" "}
                  <span>
                    {horseAvailability
                      ? `${availableRequestHorses.length} available`
                      : "Checking availability…"}
                  </span>
                </legend>
                {!horseAvailability ? (
                  <p className="field-help">
                    Checking which horses are active and not assigned to another
                    open transport request…
                  </p>
                ) : (
                  availableRequestHorses.map((horse) => (
                    <label key={horse.id}>
                      <input
                        type="checkbox"
                        checked={requestHorseIds.includes(horse.id)}
                        onChange={(event) => {
                          setRequestHorseIds((current) =>
                            event.target.checked
                              ? [...current, horse.id]
                              : current.filter((id) => id !== horse.id),
                          );
                          clearRequestFieldError("horseIds");
                        }}
                      />
                      <span>
                        <b>{horse.horseName}</b>
                        <small>
                          {horse.horseCode}
                          {horse.breed ? ` · ${horse.breed}` : ""}
                        </small>
                      </span>
                    </label>
                  ))
                )}
                {horseAvailability && !availableRequestHorses.length && (
                  <p className="field-help">
                    No horses are currently available. Only ACTIVE horses
                    without another open transport request can be selected.
                  </p>
                )}
              </fieldset>
              {requestFieldErrors.horseids && (
                <small
                  className="auth-error span-2"
                  id="horses-error"
                  role="alert"
                >
                  {requestFieldErrors.horseids}
                </small>
              )}
              <label className="span-2">
                Notes
                <input name="notes" defaultValue={pendingDraft?.input.notes} />
              </label>
              <div className="modal-actions span-2">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setRequestStep(0)}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={(event) =>
                    advanceRequestStep(event.currentTarget.form)
                  }
                  disabled={
                    busy ||
                    leadTimeLoading ||
                    routeCapabilitiesLoading ||
                    !departureIsValid ||
                    !selectedModeIsValid ||
                    !selectedHorsesAreValid
                  }
                >
                  Continue to documents
                </button>
              </div>
            </div>
            <div
              className="form-grid request-step span-2"
              style={{ display: requestStep === 2 ? "grid" : "none" }}
            >
              <section className="span-2">
                <h3>Required documents</h3>
                <p className="field-help">
                  Upload each required file before sending. The review team will
                  verify the documents after submission.
                </p>
                <div className="document-upload-grid">
                  {documentChecklist?.items.map((item) => {
                    const key = `${item.horseId}:${item.documentTypeCode}`;
                    const horse = horses.find((h) => h.id === item.horseId);
                    return (
                      <article className="document-upload-card" key={key}>
                        <div className="document-upload-info">
                          <b>{item.documentTypeName}</b>
                          <small>
                            {horse?.horseName ?? "Horse"} · {item.status}
                            {item.documentNo ? ` · ${item.documentNo}` : ""}
                          </small>
                        </div>
                        {!item.met ? (
                          <div className="document-upload-controls">
                            <label
                              className={`document-dropzone${uploadFiles[key] ? " has-file" : ""}`}
                              onDragOver={(event) => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = "copy";
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                const file = event.dataTransfer.files?.[0];
                                if (file)
                                  setUploadFiles((current) => ({
                                    ...current,
                                    [key]: file,
                                  }));
                              }}
                            >
                              <input
                                type="file"
                                aria-label={`Choose or drop ${item.documentTypeName} for ${horse?.horseName ?? "horse"}`}
                                onChange={(event) =>
                                  setUploadFiles((current) => ({
                                    ...current,
                                    [key]: event.target.files?.[0] as File,
                                  }))
                                }
                              />
                              <span
                                className="document-dropzone-icon"
                                aria-hidden="true"
                              >
                                ↑
                              </span>
                              <span>
                                <b>
                                  {uploadFiles[key]?.name ??
                                    "Choose a file or drag it here"}
                                </b>
                                <small>
                                  {uploadFiles[key]
                                    ? "File selected · click to change"
                                    : "Click to browse or drop a file"}
                                </small>
                              </span>
                            </label>
                            <div className="document-upload-footer">
                              <label>
                                Expiry date (required)
                                <input
                                  type="date"
                                  required
                                  value={uploadExpiry[key] ?? ""}
                                  onChange={(event) =>
                                    setUploadExpiry((current) => ({
                                      ...current,
                                      [key]: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <button
                                type="button"
                                disabled={
                                  uploadingKey === key ||
                                  !uploadFiles[key] ||
                                  !uploadExpiry[key]
                                }
                                onClick={() =>
                                  void uploadRequiredDocument(
                                    item.horseId,
                                    item.documentTypeCode,
                                  )
                                }
                              >
                                {uploadingKey === key
                                  ? "Uploading…"
                                  : "Upload document"}
                              </button>
                            </div>
                            <small className="field-help">
                              Enter the expiry date printed on the document.
                              Uploaded files still need Compliance approval.
                            </small>
                          </div>
                        ) : (
                          <div className="document-upload-complete">
                            Requirement satisfied · no replacement needed
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
                {!documentChecklist?.items.length && (
                  <p>No document requirements were returned for this route.</p>
                )}
                {documentChecklist?.items.some((item) => !item.uploaded) && (
                  <p className="field-help" role="status">
                    Save this request as a draft until all required documents
                    are uploaded.
                  </p>
                )}
                {documentChecklist?.items.length &&
                  documentChecklist.items.every((item) => item.uploaded) &&
                  !documentChecklist.ready && (
                    <p className="field-help" role="status">
                      Files received. You can submit now; Compliance will review
                      them before approval.
                    </p>
                  )}
              </section>
              <div className="span-2">
                <h3>Review before sending</h3>
                <section className="recipient-choice">
                  <h4>Who will receive the horses?</h4>
                  <label className="recipient-self-toggle">
                    <input
                      type="checkbox"
                      name="recipientIsRequester"
                      value="true"
                      checked={recipientIsRequester}
                      onChange={(event) => {
                        setRecipientIsRequester(event.target.checked);
                        clearRequestFieldError("recipientName");
                        clearRequestFieldError("recipientPhone");
                        clearRequestFieldError("recipientEmail");
                      }}
                    />
                    <span>
                      The person creating this request will receive the horses
                    </span>
                  </label>
                  {recipientIsRequester ? (
                    <p className="field-help">
                      We’ll use the contact details on your customer account.
                    </p>
                  ) : (
                    <div className="form-grid recipient-fields">
                      <label>
                        Recipient name
                        <input
                          name="recipientName"
                          value={recipientName}
                          aria-invalid={!!requestFieldErrors.recipientname}
                          onChange={(event) => {
                            setRecipientName(event.target.value);
                            clearRequestFieldError("recipientName");
                          }}
                          required
                        />
                        {requestFieldErrors.recipientname && (
                          <small className="auth-error">
                            {requestFieldErrors.recipientname}
                          </small>
                        )}
                      </label>
                      <label>
                        Recipient phone
                        <input
                          name="recipientPhone"
                          type="tel"
                          value={recipientPhone}
                          aria-invalid={!!requestFieldErrors.recipientphone}
                          onChange={(event) => {
                            setRecipientPhone(event.target.value);
                            clearRequestFieldError("recipientPhone");
                          }}
                          required
                        />
                        {requestFieldErrors.recipientphone && (
                          <small className="auth-error">
                            {requestFieldErrors.recipientphone}
                          </small>
                        )}
                      </label>
                      <label className="span-2">
                        Recipient email
                        <input
                          name="recipientEmail"
                          type="email"
                          value={recipientEmail}
                          aria-invalid={!!requestFieldErrors.recipientemail}
                          onChange={(event) => {
                            setRecipientEmail(event.target.value);
                            clearRequestFieldError("recipientEmail");
                          }}
                          required
                        />
                        {requestFieldErrors.recipientemail && (
                          <small className="auth-error">
                            {requestFieldErrors.recipientemail}
                          </small>
                        )}
                      </label>
                    </div>
                  )}
                </section>
                <p>
                  Pickup:{" "}
                  {locations.find(
                    (location) => location.id === originLocationId,
                  )?.name ?? "—"}
                </p>
                <p>
                  Customer collection:{" "}
                  {customPickup?.label ||
                    (customPickup
                      ? `GPS ${customPickup.point.latitude.toFixed(6)}, ${customPickup.point.longitude.toFixed(6)}`
                      : "Not requested")}
                </p>
                <p>
                  Delivery:{" "}
                  {locations.find(
                    (location) => location.id === destinationLocationId,
                  )?.name ?? "—"}
                </p>
                <p>
                  Horses:{" "}
                  {horses
                    .filter((horse) => requestHorseIds.includes(horse.id))
                    .map((horse) => horse.horseName)
                    .join(", ") || "—"}
                </p>
                <p>Departure: {requestSummary?.departure ?? "—"}</p>
                <p>Arrival: {requestSummary?.arrival ?? "—"}</p>
                <p>Mode: {requestSummary?.mode ?? "—"}</p>
                <p>
                  Delivery priority: {requestSummary?.priority ?? "STANDARD"}
                </p>
                <p>Notes: {requestSummary?.notes || "None"}</p>
                <p>
                  Recipient:{" "}
                  {recipientIsRequester
                    ? customerProfile?.contactPerson ||
                      customerProfile?.name ||
                      "Requester account"
                    : recipientName || "—"}
                  {!recipientIsRequester && recipientPhone
                    ? ` · ${recipientPhone}`
                    : ""}
                  {!recipientIsRequester && recipientEmail
                    ? ` · ${recipientEmail}`
                    : ""}
                </p>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setRequestStep(1)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={(event) =>
                    void saveRequestDraft(event.currentTarget.form)
                  }
                >
                  Save draft
                </button>
                <button
                  disabled={
                    busy ||
                    leadTimeLoading ||
                    !documentChecklist?.items.length ||
                    documentChecklist.items.some((item) => !item.uploaded) ||
                    !requestHorseIds.length ||
                    !locations.length
                  }
                >
                  {busy ? "Submitting…" : "Submit request"}
                </button>
              </div>
            </div>
          </form>
        </ActionModal>
      )}
      {requestSuccess && (
        <ActionModal
          title="Request submitted successfully"
          description="Your transport request has been sent for review."
          onClose={() => setRequestSuccess(null)}
          className="request-success-modal"
        >
          <div className="request-success-body">
            <div className="request-success-mark" aria-hidden="true">
              ✓
            </div>
            <p>We received your request.</p>
            <dl>
              <div>
                <dt>Request number</dt>
                <dd>{requestSuccess.requestNo}</dd>
              </div>
              <div>
                <dt>Request ID</dt>
                <dd>{requestSuccess.id}</dd>
              </div>
            </dl>
            <div className="modal-actions">
              <button type="button" onClick={() => setRequestSuccess(null)}>
                Done
              </button>
            </div>
          </div>
        </ActionModal>
      )}
    </div>
  );
}

type RequestJourneyTrip = {
  trip: Trip;
  execution: TripExecution | null;
  gps: GpsPoint | null;
  eta: Eta | null;
  handover: Handover | null;
  health: { horseName: string; condition?: string; recordedAt?: string }[];
};

function RequestJourneyPanel({ request }: { request: TransportRequest }) {
  const [journeys, setJourneys] = useState<RequestJourneyTrip[]>([]);
  const [invoice, setInvoice] = useState<import("../features/booking/api").PaymentInvoice | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [journeyUnavailable, setJourneyUnavailable] = useState(false);

  const loadJourney = useCallback(async () => {
    if (!request.orderId) {
      setJourneys([]);
      setJourneyUnavailable(false);
      return;
    }

    setLoading(true);
    setJourneyUnavailable(false);
    try {
      const payment = await getOrderPayment(request.orderId).catch(() => null);
      setInvoice(payment);
      const trips = await getAllMyTrips();
      const matching = await Promise.all(
        trips.map(async trip => {
          if (trip.orderId === request.orderId) return trip;
          const orders = await getMyTripOrders(trip.id).catch(() => [] as TripOrder[]);
          return orders.some(order => order.orderId === request.orderId || order.requestId === request.id) ? trip : null;
        }),
      );
      const horseNames = request.horses?.map(horse => ({ id: horse.id, name: horse.horseName })) ?? request.horseIds.map(id => ({ id, name: 'Horse' }));
      const details = await Promise.all(matching.filter((trip): trip is Trip => trip !== null).map(async trip => {
        const [execution, gps, eta, handover, health] = await Promise.all([
          getExecution(trip.id).catch(() => null),
          getLatestGps(trip.id).catch(() => null),
          getEta(trip.id).catch(() => null),
          getHandoverByTrip(trip.id).catch(() => null),
          Promise.all(horseNames.map(async horse => {
            const latest = (await getHealthLogs(trip.id, horse.id).catch(() => []))
              .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())[0];
            return { horseName: horse.name, condition: latest?.conditionType, recordedAt: latest?.recordedAt };
          })),
        ]);
        return { trip, execution, gps, eta, handover, health };
      }));
      setJourneys(details);
    } catch {
      // Customer accounts cannot browse the staff-only /my-trips endpoint.
      // Keep this section informative instead of showing a misleading global 403 toast.
      setJourneys([]);
      setJourneyUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [request.id, request.orderId, request.horseIds, request.horses]);

  useEffect(() => { void loadJourney(); }, [loadJourney]);

  const startPayment = async () => {
    if (!request.orderId) return;
    setPaymentLoading(true);
    try {
      const checkout = await createOrderPaymentCheckout(request.orderId);
      window.location.assign(checkout.checkoutUrl);
    } finally { setPaymentLoading(false); }
  };

  if (!request.orderId) return <section className="notice-card"><h3>Journey & delivery</h3><p>{request.status.toUpperCase() === 'REJECTED' ? 'This request was not approved, so no transport order or trip was created.' : 'When this request is approved, its transport order and journey updates will appear here.'}</p></section>;

  return <section className="notice-card"><div className="panel-title"><div><h3>Journey & delivery</h3><p>Order, trip progress, horse checks and handover are kept with this request.</p></div><button type="button" className="ghost small" disabled={loading} onClick={() => void loadJourney()}>{loading ? 'Refreshing…' : 'Refresh journey'}</button></div><p><b>Transport order:</b> {request.orderNo ?? request.orderId} · {request.status.replaceAll('_', ' ')}</p>{invoice && <div className="payment-summary"><div><small>Transport invoice</small><strong>{invoice.amount.toLocaleString()} {invoice.currencyCode}</strong><span>{invoice.invoiceNo} · {invoice.status.replaceAll('_', ' ')}</span></div>{invoice.status === 'PENDING_PAYMENT' && <button type="button" disabled={paymentLoading} onClick={() => void startPayment()}>{paymentLoading ? 'Opening payment…' : 'Pay with PayOS'}</button>}</div>}{loading ? <p>Loading journey details…</p> : !journeys.length ? <p className="field-help">{invoice?.status === 'PENDING_PAYMENT' ? 'Payment is required before Logistics can assign this order to a trip.' : journeyUnavailable ? 'Journey updates will appear here once Logistics places this order on a trip. The current account does not have access to staff trip details yet.' : 'The transport order is waiting for Logistics to place it on a trip. Journey updates will appear here automatically once a trip is created.'}</p> : journeys.map(({ trip, execution, gps, eta, handover, health }) => <section className="journey-request-card" key={trip.id}><div className="detail-grid"><div className="detail-field"><small>Trip</small><b>{trip.tripNo}</b></div><div className="detail-field"><small>Trip status</small><b>{trip.status.replaceAll('_', ' ')}</b></div><div className="detail-field"><small>Scheduled departure</small><b>{trip.plannedDepartureAt ? new Date(trip.plannedDepartureAt).toLocaleString() : 'Not scheduled'}</b></div><div className="detail-field"><small>Scheduled arrival</small><b>{trip.plannedArrivalAt ? new Date(trip.plannedArrivalAt).toLocaleString() : 'Not scheduled'}</b></div><div className="detail-field"><small>Journey progress</small><b>{execution?.status?.replaceAll('_', ' ') ?? 'Awaiting departure'}</b></div><div className="detail-field"><small>Estimated arrival</small><b>{eta?.currentEta ? new Date(eta.currentEta).toLocaleString() : 'Not available yet'}</b></div></div>{gps && <p className="field-help">Latest location: {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)} · {new Date(gps.recordedAt).toLocaleString()}</p>}{eta && <p className="field-help">{eta.distanceRemainingKm ?? '—'} km remaining · {eta.estimatedMinutesRemaining ?? '—'} min · {eta.onTrack === false ? `Delayed${eta.delayReason ? `: ${eta.delayReason}` : ''}` : 'On track'}</p>}<div className="journey-request-sections"><div><h4>Horse health</h4>{health.map(item => <p key={item.horseName}><b>{item.horseName}</b> · {item.condition ?? 'No observation yet'}{item.recordedAt ? ` · ${new Date(item.recordedAt).toLocaleString()}` : ''}</p>)}</div><div><h4>Handover</h4>{handover ? <><p><b>{handover.status.replaceAll('_', ' ')}</b>{handover.scheduledAt ? ` · ${new Date(handover.scheduledAt).toLocaleString()}` : ''}</p><p>{handover.receiverName ? `Receiver: ${handover.receiverName}` : 'Receiver details will appear when arranged.'}</p>{handover.horses.map(horse => <p key={horse.horseId}>{horse.status.replaceAll('_', ' ')}{horse.condition ? ` · ${horse.condition}` : ''}{horse.issueNote ? ` · ${horse.issueNote}` : ''}</p>)}</> : <p>Handover will appear here after Logistics prepares it.</p>}</div></div></section>)}</section>;
}

function ReviewView({
  report,
  notify,
}: {
  report: (s: string) => void;
  notify: (s: string) => void;
}) {
  const [queue, setQueue] = useState<RequestSummary[]>([]);
  const [selected, setSelected] = useState<TransportRequest | null>(null);
  const [reason, setReason] = useState("");
  const [pagination, setPagination] = useState(emptyPagination);
  const [requestDocuments, setRequestDocuments] = useState<
    ComplianceDocument[]
  >([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [managerChecklist, setManagerChecklist] =
    useState<RequestDocumentChecklist | null>(null);
  const [documentReviewBusyId, setDocumentReviewBusyId] = useState<
    string | null
  >(null);
  const documentReviewLock = useRef(false);
  const [managerEstimate, setManagerEstimate] =
    useState<RouteCapabilities | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [countries, setCountries] = useState<RecordRow[]>([]);
  const [queueSortBy, setQueueSortBy] = useState<"departure" | "request">(
    "departure",
  );
  const [queueSortDirection, setQueueSortDirection] = useState<"asc" | "desc">(
    "asc",
  );
  const reload = useCallback(async () => {
    try {
      const result = await getManagerQueue(
        pagination.page,
        pagination.pageSize,
        search,
        status,
        queueSortBy,
        queueSortDirection,
      );
      setQueue(result.data);
      setPagination(result.pagination);
    } catch (e) {
      report(errorText(e));
    }
  }, [
    pagination.page,
    pagination.pageSize,
    search,
    status,
    queueSortBy,
    queueSortDirection,
    report,
  ]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    Promise.all([getBookingLocations(0, 100), getRows("countries")])
      .then(([result, countryRows]) => {
        setLocations(result.data);
        setCountries(countryRows);
      })
      .catch((e) => report(errorText(e)));
  }, [report]);
  useEffect(() => {
    if (!selected) {
      setRequestDocuments([]);
      setManagerChecklist(null);
      return;
    }
    let cancelled = false;
    setDocumentsLoading(true);
    Promise.all([
      getDocuments({ requestId: selected.id }),
      ...selected.horseIds.map((horseId) => getDocuments({ horseId })),
    ])
      .then((groups) => {
        if (!cancelled) {
          const attached = groups
            .flat()
            .filter(
              (document) =>
                document.tripId == null &&
                (document.requestId === selected.id ||
                  (!document.requestId &&
                    !!document.horseId &&
                    selected.horseIds.includes(document.horseId))),
            );
          setRequestDocuments([
            ...new Map(
              attached.map((document) => [document.id, document]),
            ).values(),
          ]);
        }
      })
      .catch((e) => {
        if (!cancelled) report(errorText(e));
      })
      .finally(() => {
        if (!cancelled) setDocumentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.horseIds.join(","), report]);
  useEffect(() => {
    if (!selected?.id) return;
    let cancelled = false;
    setManagerChecklist(null);
    getManagerRequestDocumentChecklist(selected.id)
      .then((checklist) => {
        if (!cancelled) setManagerChecklist(checklist);
      })
      .catch((error) => {
        if (!cancelled) report(errorText(error));
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, report]);
  useEffect(() => {
    setManagerEstimate(null);
    if (!selected?.originLocationId || !selected.destinationLocationId) return;
    let cancelled = false;
    getRouteCapabilities(
      selected.originLocationId,
      selected.destinationLocationId,
    )
      .then((value) => {
        if (!cancelled) setManagerEstimate(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected?.originLocationId, selected?.destinationLocationId]);
  async function runReview(
    actionName: "start-review" | "request-information" | "approve" | "reject",
  ) {
    if (!selected || reviewBusy) return;
    if (
      actionName !== "start-review" &&
      actionName !== "approve" &&
      !reason.trim()
    ) {
      setReviewError(
        "Enter a reason before requesting information or declining.",
      );
      return;
    }
    setReviewBusy(true);
    setReviewError("");
    try {
      const decisionReason = reason.trim();
      const updated = await reviewRequest(
        selected.id,
        actionName,
        decisionReason,
      );
      setSelected(updated);
      if (actionName === "approve")
        setManagerChecklist(
          await getManagerRequestDocumentChecklist(updated.id),
        );
      setReason("");
      notify(
        actionName === "start-review"
          ? "Request taken into dispatch."
          : actionName === "approve"
            ? "Transport order created from the approved request."
            : `Request ${actionName.replace("-", " ")} completed.`,
      );
      await reload();
    } catch (e) {
      setReviewError(errorText(e));
    } finally {
      setReviewBusy(false);
    }
  }
  async function approveRequestDocument(
    document: ComplianceDocument,
    horseId: string,
  ) {
    if (!selected || documentReviewLock.current) return;
    documentReviewLock.current = true;
    setDocumentReviewBusyId(document.id);
    setReviewError("");
    try {
      await approveRequestHorseDocument(selected.id, horseId, document.id);
      const groups = await Promise.all([
        getDocuments({ requestId: selected.id }),
        ...selected.horseIds.map((id) => getDocuments({ horseId: id })),
      ]);
      const attached = groups
        .flat()
        .filter(
          (item) =>
            item.tripId == null &&
            (item.requestId === selected.id ||
              (!item.requestId &&
                !!item.horseId &&
                selected.horseIds.includes(item.horseId))),
        );
      setRequestDocuments([
        ...new Map(attached.map((item) => [item.id, item])).values(),
      ]);
      setManagerChecklist(
        await getManagerRequestDocumentChecklist(selected.id),
      );
      notify(`${document.documentTypeName || document.documentNo} approved.`);
    } catch (e) {
      setReviewError(errorText(e));
    } finally {
      documentReviewLock.current = false;
      setDocumentReviewBusyId(null);
    }
  }
  const countryName = (id?: string) => {
    if (!id) return "Not recorded";
    return countries.find((item) => item.id === id)?.name ?? id;
  };
  const locationDescription = (id?: string) => {
    if (!id) return "Not set";
    const location = locations.find((item) => item.id === id);
    return location
      ? [location.name, location.address, location.city]
          .filter(Boolean)
          .join(" · ")
      : id;
  };
  const originLocation = locations.find(
    (item) => item.id === selected?.originLocationId,
  );
  const destinationLocation = locations.find(
    (item) => item.id === selected?.destinationLocationId,
  );
  const selectedStatus = selected?.status.toUpperCase();
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Transport request queue</h2>
            <p>
              Take new requests into dispatch. Ask for changes only when
              information is missing; approving a request creates its transport
              order.
            </p>
          </div>
          <button className="ghost" onClick={() => void reload()}>
            Refresh
          </button>
        </div>
        <ListFilters
          query={query}
          status={status}
          statuses={[
            "SUBMITTED",
            "UNDER_REVIEW",
            "NEED_INFORMATION",
            "APPROVED",
            "REJECTED",
            "CANCELLED",
          ]}
          placeholder="Search horse name…"
          onQueryChange={setQuery}
          onStatusChange={(value) => {
            setStatus(value);
            setPagination((p) => ({ ...p, page: 0 }));
          }}
          onSearch={() => {
            setSearch(query.trim());
            setPagination((p) => ({ ...p, page: 0 }));
          }}
          onClear={() => {
            setQuery("");
            setSearch("");
            setStatus("");
            setPagination((p) => ({ ...p, page: 0 }));
          }}
        />
        <div className="table-tools">
          <label>
            Sort by
            <select
              value={queueSortBy}
              onChange={(event) => {
                setQueueSortBy(event.target.value as "departure" | "request");
                setPagination((p) => ({ ...p, page: 0 }));
              }}
            >
              <option value="departure">Departure</option>
              <option value="request">Request number</option>
            </select>
          </label>
          <label>
            Direction
            <select
              value={queueSortDirection}
              onChange={(event) => {
                setQueueSortDirection(event.target.value as "asc" | "desc");
                setPagination((p) => ({ ...p, page: 0 }));
              }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <small className="field-help">
            Sorted across all matching requests.
          </small>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Status</th>
                <th>Departure</th>
                <th>Horses</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.id}>
                  <td>{item.requestNo}</td>
                  <td>
                    <StatusBadge
                      value={item.status}
                      label={requestStatusLabel(item.status)}
                    />
                  </td>
                  <td>
                    {new Date(item.requestedDepartureAt).toLocaleString()}
                  </td>
                  <td>{item.horseCount}</td>
                  <td>
                    <button
                      className="ghost small"
                      onClick={async () => {
                        try {
                          setSelected(await getRequest(item.id, true));
                          setReason("");
                        } catch (e) {
                          report(errorText(e));
                        }
                      }}
                    >
                      {["SUBMITTED", "UNDER_REVIEW"].includes(
                        item.status.toUpperCase(),
                      )
                        ? "Open request"
                        : "View decision"}
                    </button>
                  </td>
                </tr>
              ))}
              {!queue.length && (
                <tr>
                  <td colSpan={5}>No requests match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          value={pagination}
          onChange={(page, pageSize) =>
            setPagination((p) => ({ ...p, page, pageSize }))
          }
        />
      </section>
      {selected && (
        <ActionModal
          title={selected.requestNo}
          description={`Requested by the horse owner (customer account) · ${requestStatusLabel(selected.status)}`}
          onClose={() => setSelected(null)}
          className="manager-request-modal"
        >
          <section className="notice-card">
            <b>Route & transport</b>
            <p>
              <strong>Pickup:</strong>{" "}
              {locationDescription(selected.originLocationId)}
              {selected.originLocationId && (
                <a
                  className="subtle"
                  href={osmSearchUrl(
                    locationDescription(selected.originLocationId),
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  {" "}
                  · View map
                </a>
              )}
            </p>
            <p>
              <strong>Pickup country:</strong>{" "}
              {countryName(originLocation?.countryId)}
            </p>
            <p>
              <strong>Delivery:</strong>{" "}
              {locationDescription(selected.destinationLocationId)}
              {selected.destinationLocationId && (
                <a
                  className="subtle"
                  href={osmSearchUrl(
                    locationDescription(selected.destinationLocationId),
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  {" "}
                  · View map
                </a>
              )}
            </p>
            <p>
              <strong>Delivery country:</strong>{" "}
              {countryName(destinationLocation?.countryId)}
            </p>
            <p>
              <strong>Requested departure:</strong>{" "}
              {new Date(selected.requestedDepartureAt).toLocaleString()}
            </p>
            <p>
              <strong>Estimated arrival:</strong>{" "}
              {selected.requestedArrivalAt
                ? new Date(selected.requestedArrivalAt).toLocaleString()
                : estimatedArrivalWindow(
                    managerEstimate,
                    selected.preferredTransportMode ?? "",
                    selected.requestedDepartureAt,
                    selected.deliveryPriority ?? "STANDARD",
                  )}
            </p>
            <p>
              <strong>Transport mode:</strong>{" "}
              {selected.preferredTransportMode || "Not specified"}
            </p>
            <p>
              <strong>Delivery priority:</strong>{" "}
              {selected.deliveryPriority || "STANDARD"}
            </p>
          </section>
          <section className="notice-card">
            <b>Horses selected by owner</b>
            {selected.horses?.length ? (
              <ul>
                {selected.horses.map((horse) => (
                  <li key={horse.id}>
                    <strong>{horse.horseName}</strong> · {horse.horseCode}
                    <br />
                    <span className="field-help">
                      Status: {horse.status || "Unknown"}
                      {horse.breed ? ` · ${horse.breed}` : ""}
                      {horse.sex ? ` · ${horse.sex}` : ""}
                      {horse.color ? ` · ${horse.color}` : ""}
                    </span>
                    {horse.dateOfBirth && (
                      <div className="field-help">
                        Date of birth:{" "}
                        {new Date(horse.dateOfBirth).toLocaleDateString()}
                      </div>
                    )}
                    {horse.countryOfOriginId && (
                      <div className="field-help">
                        Country of origin:{" "}
                        {countryName(horse.countryOfOriginId)}
                      </div>
                    )}
                    {horse.specialRequirements && (
                      <div className="field-help">
                        Special care: {horse.specialRequirements}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{selected.horseIds.join(", ") || "No horses selected."}</p>
            )}
          </section>
          <section className="notice-card">
            <b>Attached compliance documents</b>
            {selectedStatus === "UNDER_REVIEW" && (
              <p className="field-help">
                Review the current uploaded documents here. Approving a required
                document updates the readiness checklist.
              </p>
            )}
            {documentsLoading ? (
              <p>Loading document status…</p>
            ) : requestDocuments.length ? (
              <ul>
                {requestDocuments.map((document) => {
                  const requiredItem = managerChecklist?.items.find(
                    (item) =>
                      item.horseId === document.horseId &&
                      item.documentNo === document.documentNo,
                  );
                  const canApprove =
                    selectedStatus === "UNDER_REVIEW" &&
                    requiredItem &&
                    !requiredItem.met &&
                    requiredItem.status.toUpperCase() === "UPLOADED" &&
                    document.status.toUpperCase() === "UPLOADED";
                  return (
                    <li key={document.id}>
                      {document.documentTypeName || document.documentNo} ·{" "}
                      <em>{document.status}</em>
                      {document.expiryDate
                        ? ` · Expires ${new Date(document.expiryDate).toLocaleDateString()}`
                        : ""}{" "}
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() =>
                          void openSecureDocument(document, report)
                        }
                      >
                        Open file
                      </button>
                      {canApprove && (
                        <button
                          type="button"
                          className="small"
                          disabled={documentReviewBusyId !== null}
                          onClick={() =>
                            void approveRequestDocument(
                              document,
                              document.horseId!,
                            )
                          }
                        >
                          {documentReviewBusyId === document.id
                            ? "Approving…"
                            : "Approve document"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No documents are attached to this request or its horses.</p>
            )}
            <small>
              {managerChecklist
                ? managerChecklist.ready
                  ? "Required documents are approved and valid for departure."
                  : `${managerChecklist.items.filter((item) => !item.met).length} required document(s) still need approval or renewal before this request can be approved.`
                : "Checking required documents…"}
            </small>
            {managerChecklist?.items
              .filter((item) => !item.met)
              .map((item) => (
                <p
                  key={`${item.horseId}:${item.documentTypeCode}`}
                  className="field-help"
                >
                  {item.documentTypeName} ·{" "}
                  {selected.horses?.find((horse) => horse.id === item.horseId)
                    ?.horseName ?? item.horseId}{" "}
                  · {item.status}
                </p>
              ))}
          </section>
          {selected.customPickupLatitude != null &&
            selected.customPickupLongitude != null && (
              <section className="notice-card">
                <b>Customer collection point</b>
                <p>
                  {selected.customPickupLabel ||
                    `${selected.customPickupLatitude.toFixed(6)}, ${selected.customPickupLongitude.toFixed(6)}`}
                </p>
                <p>
                  The driver collects the horse here and transports it to the
                  registered pickup location:{" "}
                  {locations.find(
                    (location) => location.id === selected.originLocationId,
                  )?.name ?? "Pickup location"}
                  .
                </p>
              </section>
            )}
          <p>
            {selected.specialRequirements ||
              selected.notes ||
              "No additional notes."}
          </p>
          {selectedStatus === "SUBMITTED" && (
            <>
              <p className="field-help">
                Take ownership of this request to handle it. After that, you can
                request missing information or approve it and create the
                transport order.
              </p>
              <button
                disabled={reviewBusy}
                onClick={() => void runReview("start-review")}
              >
                Take request
              </button>
            </>
          )}
          {selectedStatus === "UNDER_REVIEW" && (
            <>
              <label>
                Decision note{" "}
                <span className="field-hint">
                  Required when requesting information or declining; optional
                  when approving
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReviewError("");
                  }}
                  rows={3}
                />
                {reviewError && (
                  <small className="auth-error" role="alert">
                    {reviewError}
                  </small>
                )}
              </label>
              <div className="header-actions" style={{ marginTop: 14 }}>
                <button
                  className="ghost"
                  disabled={reviewBusy || !reason.trim()}
                  onClick={() => void runReview("request-information")}
                >
                  Ask for missing information
                </button>
                <button
                  disabled={reviewBusy || !managerChecklist?.ready}
                  onClick={() => void runReview("approve")}
                >
                  Approve & create transport order
                </button>
                <button
                  className="danger"
                  disabled={reviewBusy || !reason.trim()}
                  onClick={() => void runReview("reject")}
                >
                  Decline request
                </button>
              </div>
            </>
          )}
          {selectedStatus === "APPROVED" && (
            <div className="notice-card">
              <b>
                Transport order created
                {selected.orderNo ? ` · ${selected.orderNo}` : ""}.
              </b>
              <p>
                It is now on the Logistics calendar for its requested departure
                date. Logistics will create a trip after grouping compatible
                orders.
              </p>
            </div>
          )}
          {["REJECTED", "NEED_INFORMATION"].includes(selectedStatus ?? "") && (
            <div className="notice-card">
              <b>
                {selectedStatus === "REJECTED"
                  ? "Request declined"
                  : "More information requested"}
              </b>
              <p>{selected.reviewReason || "No decision note was recorded."}</p>
            </div>
          )}
        </ActionModal>
      )}
    </div>
  );
}

function ComplianceView({
  section,
  role,
  report,
  notify,
}: {
  section: "documents" | "readiness" | "clearance";
  role: string;
  report: (s: string) => void;
  notify: (s: string) => void;
}) {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [documentQuery, setDocumentQuery] = useState("");
  const [documentStatus, setDocumentStatus] = useState("");
  const [documentScopeFilter, setDocumentScopeFilter] = useState("");
  const [documentSort, setDocumentSort] = useState("expiry-asc");
  const [readiness, setReadiness] = useState<ComplianceReadiness | null>(null);
  const [clearances, setClearances] = useState<ClearanceCase[]>([]);
  const [clearanceLoading, setClearanceLoading] = useState(false);
  const [clearanceQuery, setClearanceQuery] = useState("");
  const [clearanceSearch, setClearanceSearch] = useState("");
  const [clearanceStatus, setClearanceStatus] = useState("");
  const [clearanceCountry, setClearanceCountry] = useState("");
  const [clearanceSort, setClearanceSort] = useState("updatedAt");
  const [clearanceSortDirection, setClearanceSortDirection] = useState<
    "asc" | "desc"
  >("desc");
  const [selectedClearance, setSelectedClearance] =
    useState<ClearanceCase | null>(null);
  const [tripChoices, setTripChoices] = useState<Trip[]>([]);
  const [tripChoicesLoading, setTripChoicesLoading] = useState(false);
  const [complianceTripId, setComplianceTripId] = useState("");
  const [readinessTrips, setReadinessTrips] = useState<Trip[]>([]);
  const [readinessTripsLoading, setReadinessTripsLoading] = useState(false);
  const [readinessQuery, setReadinessQuery] = useState("");
  const [readinessSearch, setReadinessSearch] = useState("");
  const [readinessStatus, setReadinessStatus] = useState("");
  const [readinessSort, setReadinessSort] = useState("departure");
  const [readinessSortDirection, setReadinessSortDirection] = useState<
    "asc" | "desc"
  >("desc");
  const [readinessPagination, setReadinessPagination] =
    useState<PaginationMeta>({
      page: 0,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    });
  const [selectedReadinessTrip, setSelectedReadinessTrip] =
    useState<Trip | null>(null);
  const [readinessReloadKey, setReadinessReloadKey] = useState(0);
  const [complianceCountries, setComplianceCountries] = useState<RecordRow[]>(
    [],
  );
  const [complianceLocations, setComplianceLocations] = useState<Location[]>(
    [],
  );
  const [complianceRouteCountries, setComplianceRouteCountries] = useState<{
    originCountryId: string;
    destinationCountryId: string;
  }>({ originCountryId: "", destinationCountryId: "" });
  const [complianceRouteLegs, setComplianceRouteLegs] = useState<ComplianceRouteLeg[]>([]);
  const [complianceRequestIds, setComplianceRequestIds] = useState<string[]>([]);
  const [selectedClearanceRouteLegId, setSelectedClearanceRouteLegId] = useState("");
  const [complianceHorseIds, setComplianceHorseIds] = useState<string[]>([]);
  const [complianceHorseNames, setComplianceHorseNames] = useState<
    Record<string, string>
  >({});
  const [tripContextLoading, setTripContextLoading] = useState(false);
  const [tripContextError, setTripContextError] = useState("");
  const [documentPreviewBusy, setDocumentPreviewBusy] = useState("");
  const [rejectionDocument, setRejectionDocument] =
    useState<ComplianceDocument | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionOpen, setActionOpen] = useState<"upload" | "clearance" | null>(
    null,
  );
  const [ownedHorses, setOwnedHorses] = useState<Horse[]>([]);
  const [ownedRequests, setOwnedRequests] = useState<TransportRequest[]>([]);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState("");
  const [documentHorseId, setDocumentHorseId] = useState("");
  const [documentRequestId, setDocumentRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewingDocumentId, setReviewingDocumentId] = useState("");
  const reviewer = role === "COMPLIANCE_OFFICER" || role === "ADMIN";
  const canUpload = role === "CUSTOMER";
  const documentScope = (
    types.find((type) => type.id === selectedDocumentTypeId)?.scope ?? ""
  ).toLowerCase();
  const scopeHasHorse =
    documentScope === "horse" || documentScope === "request";
  const scopeHasRequest = documentScope === "request";
  const scopeHasTrip = documentScope === "trip";
  const requestsForSelectedHorse = ownedRequests.filter(
    (request) => !documentHorseId || request.horseIds.includes(documentHorseId),
  );
  const visibleDocuments = useMemo(() => {
    const query = documentQuery.trim().toLocaleLowerCase();
    const filtered = documents.filter((document) => {
      const scope = document.horseId
        ? "horse"
        : document.tripId
          ? "trip"
          : document.requestId
            ? "request"
            : "";
      const entityId =
        document.horseId ?? document.tripId ?? document.requestId ?? "";
      const text = [
        document.documentNo,
        document.fileName,
        document.documentTypeName,
        document.documentTypeId,
        entityId,
        document.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!query || text.includes(query)) &&
        (!documentStatus || document.status.toUpperCase() === documentStatus) &&
        (!documentScopeFilter || scope === documentScopeFilter)
      );
    });
    return filtered.sort((a, b) => {
      const dateA = a.expiryDate
        ? new Date(a.expiryDate).getTime()
        : Number.POSITIVE_INFINITY;
      const dateB = b.expiryDate
        ? new Date(b.expiryDate).getTime()
        : Number.POSITIVE_INFINITY;
      if (documentSort === "expiry-desc") return dateB - dateA;
      if (documentSort === "type")
        return (a.documentTypeName ?? a.documentTypeId).localeCompare(
          b.documentTypeName ?? b.documentTypeId,
        );
      if (documentSort === "status")
        return (
          a.status.localeCompare(b.status) ||
          a.documentNo.localeCompare(b.documentNo)
        );
      return dateA - dateB || a.documentNo.localeCompare(b.documentNo);
    });
  }, [
    documents,
    documentQuery,
    documentStatus,
    documentScopeFilter,
    documentSort,
  ]);
  const reloadDocuments = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([getDocumentTypes(), getDocuments()]);
      setTypes(t);
      setDocuments(d);
      if (role === "CUSTOMER") {
        const [horsePage, requestPage] = await Promise.all([
          getHorses(0, 100),
          getRequests(0, 100),
        ]);
        setOwnedHorses(horsePage.data);
        const details = await Promise.all(
          requestPage.data.map((item) => getRequest(item.id)),
        );
        setOwnedRequests(details);
      }
    } catch (e) {
      report(errorText(e));
    }
  }, [report, role]);

  useEffect(() => {
    if (section === "documents") void reloadDocuments();
  }, [section, reloadDocuments]);

  const reloadClearances = useCallback(async () => {
    setClearanceLoading(true);
    try {
      const rows = await getAllClearanceCases({
        search: clearanceSearch,
        status: clearanceStatus,
        countryId: clearanceCountry,
        sortBy: clearanceSort,
        sortDirection: clearanceSortDirection,
      });
      setClearances(rows);
      setSelectedClearance((current) =>
        current ? (rows.find((row) => row.id === current.id) ?? null) : null,
      );
    } catch (e) {
      report(errorText(e));
    } finally {
      setClearanceLoading(false);
    }
  }, [
    report,
    clearanceSearch,
    clearanceStatus,
    clearanceCountry,
    clearanceSort,
    clearanceSortDirection,
  ]);

  useEffect(() => {
    if (section === "clearance" && role !== "CUSTOMER") void reloadClearances();
  }, [section, role, reloadClearances]);

  useEffect(() => {
    if (section !== "clearance" || role === "CUSTOMER") return;
    let cancelled = false;
    setTripChoicesLoading(true);
    getAllTrips()
      .then((rows) => {
        if (!cancelled) setTripChoices(rows);
      })
      .catch((e) => {
        if (!cancelled) report(errorText(e));
      })
      .finally(() => {
        if (!cancelled) setTripChoicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, role, report]);

  useEffect(() => {
    if (section !== "readiness" || role === "CUSTOMER") return;
    let cancelled = false;
    setReadinessTripsLoading(true);
    getTrips(
      readinessPagination.page,
      readinessPagination.pageSize,
      readinessSearch,
      readinessStatus,
      readinessSort,
      readinessSortDirection,
    )
      .then((result) => {
        if (cancelled) return;
        setReadinessTrips(result.data);
        setReadinessPagination(result.pagination);
        setSelectedReadinessTrip((current) =>
          current
            ? (result.data.find((trip) => trip.id === current.id) ?? current)
            : null,
        );
      })
      .catch((error) => {
        if (!cancelled) report(errorText(error));
      })
      .finally(() => {
        if (!cancelled) setReadinessTripsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    section,
    role,
    readinessPagination.page,
    readinessPagination.pageSize,
    readinessSearch,
    readinessStatus,
    readinessSort,
    readinessSortDirection,
    readinessReloadKey,
    report,
  ]);

  useEffect(() => {
    if (!["readiness", "clearance"].includes(section)) return;
    let cancelled = false;
    Promise.all([getRows("countries"), getBookingLocations(0, 200)])
      .then(([countries, locationPage]) => {
        if (cancelled) return;
        setComplianceCountries(countries);
        setComplianceLocations(locationPage.data);
      })
      .catch((e) => {
        if (!cancelled) report(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, [section, report]);

  useEffect(() => {
    if (!["readiness", "clearance"].includes(section) || !complianceTripId) {
      setComplianceRouteCountries({
        originCountryId: "",
        destinationCountryId: "",
      });
      setComplianceRouteLegs([]);
      setComplianceRequestIds([]);
      setSelectedClearanceRouteLegId("");
      setComplianceHorseIds([]);
      setComplianceHorseNames({});
      setTripContextError("");
      setTripContextLoading(false);
      return;
    }
    let cancelled = false;
    setTripContextLoading(true);
    setTripContextError("");
    setReadiness(null);
    void (async () => {
      try {
        const [orders, plan] = await Promise.all([
          getTripOrders(complianceTripId),
          getRoutePlanByTrip(complianceTripId),
        ]);
        let versionId = plan.activeVersionId;
        if (!versionId) {
          const versions = await getVersions(plan.id);
          versionId =
            versions.find((item) =>
              ["ACTIVE", "APPROVED"].includes(item.status.toUpperCase()),
            )?.id ?? versions.at(-1)?.id;
        }
        if (!versionId)
          throw new Error(
            "The trip has no route version yet. Add a route plan before evaluating compliance.",
          );
        const legs = await getLegs(versionId);
        if (!legs.length)
          throw new Error(
            "The request pickup-to-delivery route is not available for this trip yet. Refresh trips or contact Logistics.",
          );
        const orderedLegs = [...legs].sort(
          (a, b) => Number(a.sequenceNo ?? 0) - Number(b.sequenceNo ?? 0),
        );
        const horseIds = [
          ...new Set(
            orders
              .flatMap((order) => order.horseIds ?? [])
              .map((horseId) => String(horseId))
              .filter(Boolean),
          ),
        ];
        const requestIds = [
          ...new Set(orders.map((order) => String(order.requestId ?? "")).filter(Boolean)),
        ];
        const trip = tripChoices.find((item) => item.id === complianceTripId);
        const routeContexts = orderedLegs.map((leg) => {
          const originLocation = complianceLocations.find(
            (location) => location.id === String(leg.originLocationId ?? ""),
          );
          const destinationLocation = complianceLocations.find(
            (location) => location.id === String(leg.destinationLocationId ?? ""),
          );
          const plannedDepartureAt = String(
            leg.plannedDepartureAt ?? trip?.plannedDepartureAt ?? "",
          );
          if (!originLocation?.countryId || !destinationLocation?.countryId || !plannedDepartureAt)
            return null;
          return {
            routeLegId: String(leg.id),
            originCountryId: originLocation.countryId,
            destinationCountryId: destinationLocation.countryId,
            plannedDepartureAt,
            plannedArrivalAt: leg.plannedArrivalAt ? String(leg.plannedArrivalAt) : null,
          };
        });
        if (!cancelled) {
          if (orders.some((order) => !order.requestId))
            throw new Error("A trip order has no linked request. Compliance cannot evaluate request-scoped documents.");
          if (routeContexts.some((context) => context === null))
            throw new Error("Every route leg needs valid origin and destination countries and a planned departure time before compliance can be evaluated.");
          const evaluatedRouteLegs = routeContexts as ComplianceRouteLeg[];
          setComplianceRouteCountries({
            originCountryId: evaluatedRouteLegs[0].originCountryId,
            destinationCountryId: evaluatedRouteLegs[evaluatedRouteLegs.length - 1].destinationCountryId,
          });
          setComplianceRouteLegs(evaluatedRouteLegs);
          setComplianceRequestIds(requestIds);
          setSelectedClearanceRouteLegId((current) =>
            evaluatedRouteLegs.some((leg) => leg.routeLegId === current)
              ? current
              : evaluatedRouteLegs[0].routeLegId,
          );
          setComplianceHorseIds(horseIds);
          // Planning assignments intentionally expose IDs only. Try the authenticated horse catalog for names;
          // if that role cannot read it, the UI still lists the trip's assigned horses without exposing IDs.
          const horsePage = await getHorses(0, 100).catch(() => null);
          if (!cancelled) {
            const names: Record<string, string> = {};
            for (const [index, horseId] of horseIds.entries()) {
              const horse = horsePage?.data.find((item) => item.id === horseId);
              names[horseId] = horse
                ? `${horse.horseName} · ${horse.horseCode}`
                : `Horse ${index + 1}`;
            }
            setComplianceHorseNames(names);
            if (!horseIds.length && section === "readiness")
              setTripContextError(
                "No requested horses are linked to this trip. Refresh the trip orders before evaluating compliance.",
              );
          }
        }
      } catch (e) {
        if (!cancelled) setTripContextError(errorText(e));
      } finally {
        if (!cancelled) setTripContextLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, complianceTripId, complianceLocations, tripChoices]);

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const file = form.get("file");
      if (!(file instanceof File) || !file.size)
        throw new Error("Choose a document file first.");
      const payload = new FormData();
      payload.set("file", file);
      payload.set("documentTypeId", String(form.get("documentTypeId")));
      for (const key of [
        "horseId",
        "requestId",
        "tripId",
        "issueDate",
        "expiryDate",
        "issuingAuthority",
      ]) {
        const value = String(form.get(key) ?? "");
        if (value) payload.set(key, value);
      }
      await uploadDocumentFile(payload);
      formElement.reset();
      setActionOpen(null);
      notify("Compliance document uploaded.");
      await reloadDocuments();
    } catch (e) {
      report(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function evaluate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !complianceRequestIds.length ||
      !complianceRouteLegs.length ||
      !complianceHorseIds.length
    ) {
      setTripContextError(
        "Select a trip with a saved route and linked request horses before evaluating compliance.",
      );
      return;
    }
    setBusy(true);
    try {
      setReadiness(
        await evaluateCompliance({
          tripId: complianceTripId,
          requestIds: complianceRequestIds,
          horseIds: complianceHorseIds,
          routeLegs: complianceRouteLegs,
        }),
      );
    } catch (e) {
      report(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const selectedComplianceTrip =
    (selectedReadinessTrip?.id === complianceTripId
      ? selectedReadinessTrip
      : null) ?? tripChoices.find((item) => item.id === complianceTripId);
  const selectedClearanceRouteLeg = complianceRouteLegs.find(
    (leg) => leg.routeLegId === selectedClearanceRouteLegId,
  );

  async function openDocumentFile(document: ComplianceDocument) {
    setDocumentPreviewBusy(document.id);
    await openSecureDocument(document, report);
    setDocumentPreviewBusy("");
  }

  async function decideDocument(
    document: ComplianceDocument,
    status: "APPROVED" | "REJECTED",
    comment: string,
  ): Promise<boolean> {
    if (!reviewer || reviewingDocumentId) return false;
    setReviewingDocumentId(document.id);
    try {
      await reviewDocument(document.id, status, comment);
      notify(
        status === "APPROVED" ? "Document approved." : "Document rejected.",
      );
      await reloadDocuments();
      return true;
    } catch (e) {
      report(errorText(e));
      return false;
    } finally {
      setReviewingDocumentId("");
    }
  }

  async function submitDocumentRejection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectionDocument || !rejectionReason.trim()) return;
    if (
      await decideDocument(
        rejectionDocument,
        "REJECTED",
        rejectionReason.trim(),
      )
    ) {
      setRejectionDocument(null);
      setRejectionReason("");
    }
  }

  async function makeClearance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const f = new FormData(formElement);
    setBusy(true);
    try {
      await createClearanceCase({
        tripId: String(f.get("tripId")),
        routeLegId: String(f.get("routeLegId")),
        countryId: String(f.get("countryId")),
        clearanceType: String(f.get("clearanceType") || "CUSTOMS") as "CUSTOMS" | "QUARANTINE" | "INSPECTION",
        authorityName: String(f.get("authorityName")),
        referenceNumber: String(f.get("referenceNumber") || ""),
        notes: String(f.get("notes") || ""),
      });
      await reloadClearances();
      formElement.reset();
      setActionOpen(null);
      notify("Clearance case created.");
    } catch (e) {
      report(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (section === "documents") {
    return (
      <div className="stack">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Compliance documents</h2>
              <p>
                Upload horse, request or trip evidence and track review status.
              </p>
            </div>
            <div className="header-actions">
              <button className="ghost" onClick={() => void reloadDocuments()}>
                Refresh
              </button>
              {canUpload && (
                <button onClick={() => setActionOpen("upload")}>
                  + Upload evidence
                </button>
              )}
            </div>
          </div>
          <div className="table-tools">
            <label>
              Search documents
              <input
                value={documentQuery}
                onChange={(event) => setDocumentQuery(event.target.value)}
                placeholder="Document no., file, type or entity…"
              />
            </label>
            <label>
              Status
              <select
                value={documentStatus}
                onChange={(event) => setDocumentStatus(event.target.value)}
              >
                <option value="">All statuses</option>
                {[
                  ...new Set(
                    documents.map((document) => document.status.toUpperCase()),
                  ),
                ]
                  .sort()
                  .map((status) => (
                    <option key={status} value={status}>
                      {requestStatusLabels[status] ??
                        status.replaceAll("_", " ")}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Scope
              <select
                value={documentScopeFilter}
                onChange={(event) => setDocumentScopeFilter(event.target.value)}
              >
                <option value="">All scopes</option>
                <option value="horse">Horse</option>
                <option value="request">Request</option>
                <option value="trip">Trip</option>
              </select>
            </label>
            <label>
              Sort by
              <select
                value={documentSort}
                onChange={(event) => setDocumentSort(event.target.value)}
              >
                <option value="expiry-asc">Expiry · earliest first</option>
                <option value="expiry-desc">Expiry · latest first</option>
                <option value="type">Document type</option>
                <option value="status">Status</option>
              </select>
            </label>
            {(documentQuery || documentStatus || documentScopeFilter) && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setDocumentQuery("");
                  setDocumentStatus("");
                  setDocumentScopeFilter("");
                }}
              >
                Clear filters
              </button>
            )}
            <small className="field-help">
              {visibleDocuments.length} of {documents.length} documents
            </small>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Scope</th>
                  <th>Entity</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleDocuments.map((d) => {
                  const canReview = [
                    "UPLOADED",
                    "UNDER_REVIEW",
                    "NEED_ADDITIONAL_INFO",
                  ].includes(d.status.toUpperCase());
                  return (
                    <tr key={d.id}>
                      <td>
                        {d.documentNo}
                        <small className="subtle">{d.fileName}</small>
                      </td>
                      <td>{d.documentTypeName ?? d.documentTypeId}</td>
                      <td>
                        {d.horseId
                          ? "Horse"
                          : d.tripId
                            ? "Trip"
                            : d.requestId
                              ? "Request"
                              : "—"}
                      </td>
                      <td className="mono">
                        {d.horseId ?? d.tripId ?? d.requestId ?? "—"}
                      </td>
                      <td>
                        <em>{d.status}</em>
                      </td>
                      <td>{d.expiryDate ?? "—"}</td>
                      <td>
                        <span className="header-actions">
                          <button
                            className="ghost small"
                            disabled={documentPreviewBusy === d.id}
                            onClick={() => void openDocumentFile(d)}
                          >
                            {documentPreviewBusy === d.id
                              ? "Opening…"
                              : "Open file"}
                          </button>
                          {reviewer && canReview && (
                            <>
                              <button
                                className="small"
                                disabled={!!reviewingDocumentId}
                                onClick={() =>
                                  void decideDocument(d, "APPROVED", "")
                                }
                              >
                                {reviewingDocumentId === d.id
                                  ? "Saving…"
                                  : "Approve"}
                              </button>
                              <button
                                className="danger small"
                                disabled={!!reviewingDocumentId}
                                onClick={() => {
                                  setRejectionDocument(d);
                                  setRejectionReason("");
                                }}
                              >
                                {"Reject"}
                              </button>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!visibleDocuments.length && (
                  <tr>
                    <td colSpan={7}>
                      {documents.length
                        ? "No documents match these filters."
                        : "No compliance documents found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        {actionOpen === "upload" && canUpload && (
          <ActionModal
            title="Upload compliance evidence"
            description="Choose the document type first. The form then asks only for the related horse, request, or trip."
            onClose={() => setActionOpen(null)}
          >
            <form className="form-grid document-upload-form" onSubmit={upload}>
              <label>
                Document type
                <select
                  name="documentTypeId"
                  required
                  value={selectedDocumentTypeId}
                  onChange={(event) => {
                    setSelectedDocumentTypeId(event.target.value);
                    setDocumentHorseId("");
                    setDocumentRequestId("");
                  }}
                >
                  <option value="" disabled>
                    Select type
                  </option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.scope}
                    </option>
                  ))}
                </select>
              </label>
              {scopeHasHorse &&
                (role === "CUSTOMER" ? (
                  <label>
                    Horse
                    <select
                      name="horseId"
                      required
                      value={documentHorseId}
                      onChange={(event) => {
                        setDocumentHorseId(event.target.value);
                        setDocumentRequestId("");
                      }}
                    >
                      <option value="">Select your horse</option>
                      {ownedHorses.map((horse) => (
                        <option key={horse.id} value={horse.id}>
                          {horse.horseName} · {horse.horseCode}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    Horse ID
                    <input name="horseId" />
                  </label>
                ))}
              {scopeHasRequest &&
                (role === "CUSTOMER" ? (
                  <label>
                    Related request
                    <select
                      name="requestId"
                      required
                      value={documentRequestId}
                      onChange={(event) =>
                        setDocumentRequestId(event.target.value)
                      }
                    >
                      <option value="">Select a request for this horse</option>
                      {requestsForSelectedHorse.map((request) => (
                        <option key={request.id} value={request.id}>
                          {request.requestNo} · {request.status}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    Related request ID
                    <input name="requestId" />
                  </label>
                ))}
              {scopeHasTrip && (
                <label>
                  Trip ID
                  <input
                    name="tripId"
                    placeholder="Use the trip ID from the transport confirmation"
                    required
                  />
                  <small className="field-help">
                    The approved request creates a transport order, and the trip
                    is linked to that order. Enter the Trip ID from the approved
                    transport details; this customer view does not yet list
                    trips automatically.
                  </small>
                </label>
              )}
              {scopeHasRequest && role === "CUSTOMER" && (
                <p className="field-help span-2">
                  Request choices are limited to requests that include the
                  selected horse.
                </p>
              )}
              <div className="document-upload-dates span-2">
                <label>
                  Issue date{" "}
                  <span className="field-hint">
                    Date printed on the document
                  </span>
                  <input name="issueDate" type="date" />
                </label>
                <label>
                  Expiry date{" "}
                  <span className="field-hint">
                    Last day the document is valid
                  </span>
                  <input name="expiryDate" type="date" />
                </label>
              </div>
              <label>
                Issued by{" "}
                <span className="field-hint">
                  Example: FEI or government veterinary authority
                </span>
                <input
                  name="issuingAuthority"
                  placeholder="Name of the organization that issued it"
                />
              </label>
              <label className="span-2">
                Evidence file (PDF or photo)
                <input
                  name="file"
                  type="file"
                  accept="application/pdf,image/*"
                  required
                />
              </label>
              <p className="field-help span-2">
                If issue or expiry dates are not shown on the document, leave
                them blank. The system may use the document type’s default
                validity period.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setActionOpen(null)}
                >
                  Cancel
                </button>
                <button disabled={busy || !selectedDocumentTypeId}>
                  {busy ? "Uploading…" : "Upload evidence"}
                </button>
              </div>
            </form>
          </ActionModal>
        )}
        {rejectionDocument && reviewer && (
          <ActionModal
            className="reject-document-modal"
            title="Reject document"
            description="Check the document details and provide a reason."
            onClose={() => {
              if (!reviewingDocumentId) {
                setRejectionDocument(null);
                setRejectionReason("");
              }
            }}
          >
            <form
              className="form-grid reject-document-form"
              onSubmit={submitDocumentRejection}
            >
              <div className="reject-document-heading span-2">
                <div>
                  <small>Selected document</small>
                  <b>{rejectionDocument.documentNo}</b>
                </div>
                <em>{rejectionDocument.status}</em>
              </div>
              <dl className="reject-document-details span-2">
                <div>
                  <dt>Document type</dt>
                  <dd>
                    {rejectionDocument.documentTypeName ??
                      rejectionDocument.documentTypeId}
                  </dd>
                </div>
                <div>
                  <dt>File</dt>
                  <dd>{rejectionDocument.fileName}</dd>
                </div>
                <div>
                  <dt>Scope</dt>
                  <dd>
                    {rejectionDocument.horseId
                      ? "Horse"
                      : rejectionDocument.tripId
                        ? "Trip"
                        : rejectionDocument.requestId
                          ? "Request"
                          : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Related record</dt>
                  <dd className="mono">
                    {rejectionDocument.horseId ??
                      rejectionDocument.tripId ??
                      rejectionDocument.requestId ??
                      "—"}
                  </dd>
                </div>
                <div>
                  <dt>Expiry date</dt>
                  <dd>{rejectionDocument.expiryDate ?? "—"}</dd>
                </div>
              </dl>
              <label className="span-2">
                Reason for rejection
                <textarea
                  autoFocus
                  required
                  minLength={2}
                  maxLength={1000}
                  rows={4}
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Explain what needs to be corrected or provided…"
                />
                <small className="field-help">
                  This reason will be saved with the review decision and shown
                  to the document owner.
                </small>
              </label>
              <div className="modal-actions span-2">
                <button
                  type="button"
                  className="ghost"
                  disabled={!!reviewingDocumentId}
                  onClick={() => {
                    setRejectionDocument(null);
                    setRejectionReason("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="danger"
                  disabled={!!reviewingDocumentId || !rejectionReason.trim()}
                >
                  {reviewingDocumentId === rejectionDocument.id
                    ? "Rejecting…"
                    : "Confirm rejection"}
                </button>
              </div>
            </form>
          </ActionModal>
        )}
      </div>
    );
  }

  if (section === "readiness") {
    return (
      <div className="stack">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Trip compliance readiness</h2>
              <p>
                Find a trip, inspect its route and horses, then evaluate
                required documents.
              </p>
            </div>
            <button
              className="ghost"
              disabled={readinessTripsLoading}
              onClick={() => setReadinessReloadKey((value) => value + 1)}
            >
              {readinessTripsLoading ? "Refreshing…" : "Refresh trips"}
            </button>
          </div>
          <ListFilters
            query={readinessQuery}
            status={readinessStatus}
            statuses={[
              "PLANNED",
              "READY",
              "DEPARTED",
              "ARRIVED",
              "COMPLETED",
              "CANCELLED",
            ]}
            placeholder="Trip number or ID…"
            onQueryChange={setReadinessQuery}
            onStatusChange={(value) => {
              setReadinessStatus(value);
              setReadinessPagination((current) => ({ ...current, page: 0 }));
            }}
            onSearch={() => {
              setReadinessSearch(readinessQuery.trim());
              setReadinessPagination((current) => ({ ...current, page: 0 }));
            }}
            onClear={() => {
              setReadinessQuery("");
              setReadinessSearch("");
              setReadinessStatus("");
              setReadinessPagination((current) => ({ ...current, page: 0 }));
            }}
          />
          <div className="table-tools">
            <label>
              Sort by
              <select
                value={readinessSort}
                onChange={(event) => {
                  setReadinessSort(event.target.value);
                  setReadinessPagination((current) => ({
                    ...current,
                    page: 0,
                  }));
                }}
              >
                <option value="departure">Departure</option>
                <option value="tripNo">Trip number</option>
                <option value="status">Status</option>
                <option value="createdAt">Date created</option>
              </select>
            </label>
            <label>
              Direction
              <select
                value={readinessSortDirection}
                onChange={(event) => {
                  setReadinessSortDirection(
                    event.target.value as "asc" | "desc",
                  );
                  setReadinessPagination((current) => ({
                    ...current,
                    page: 0,
                  }));
                }}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
            <small className="field-help">
              Search, filters, sorting and pagination are applied by the API.
            </small>
          </div>
          <div className="table-wrap">
            <table className="trip-dashboard-table">
              <thead>
                <tr>
                  <th>Trip</th>
                  <th>Status</th>
                  <th>Departure</th>
                  <th>Compliance</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {readinessTrips.map((trip) => (
                  <tr
                    key={trip.id}
                    className={complianceTripId === trip.id ? "selected" : ""}
                  >
                    <td>
                      <b>{trip.customerNames?.join(", ") || trip.tripNo}</b>
                      <small>
                        {trip.horseNames?.join(", ") || trip.tripNo}
                      </small>
                      <small>
                        {trip.tripNo} · {trip.orderCount ?? 1} order
                        {(trip.orderCount ?? 1) === 1 ? "" : "s"}
                      </small>
                      <small className="mono">Record ID · {trip.id}</small>
                    </td>
                    <td>
                      <StatusBadge value={trip.status} />
                    </td>
                    <td>
                      {trip.plannedDepartureAt
                        ? new Date(trip.plannedDepartureAt).toLocaleString()
                        : "Not scheduled"}
                    </td>
                    <td>
                      <span
                        className={`trip-compliance-state ${trip.complianceReady ? "is-ready" : "is-pending"}`}
                      >
                        {trip.complianceReady ? "Ready" : "Pending"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="ghost small"
                        onClick={() => {
                          setSelectedReadinessTrip(trip);
                          setComplianceTripId(trip.id);
                          setReadiness(null);
                        }}
                      >
                        Open trip
                      </button>
                    </td>
                  </tr>
                ))}
                {!readinessTrips.length && (
                  <tr>
                    <td colSpan={5}>
                      {readinessTripsLoading
                        ? "Loading trips…"
                        : "No trips match these filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            value={readinessPagination}
            onChange={(page, pageSize) =>
              setReadinessPagination((current) => ({
                ...current,
                page,
                pageSize,
              }))
            }
          />
        </section>
        {complianceTripId && (
          <ModalDialog
            title={`${selectedComplianceTrip?.tripNo ?? "Selected trip"} · requirements`}
            description="Review the route legs and requested horses, then evaluate compliance."
            onClose={() => {
              setComplianceTripId("");
              setSelectedReadinessTrip(null);
              setReadiness(null);
            }}
          >
            <form className="form-grid" onSubmit={evaluate}>
              <div className="notice-card">
                <b>Trip requirements context</b>
                {tripContextLoading ? (
                  <p>Loading route and requested horses…</p>
                ) : (
                  <>
                    <p>
                      Origin country:{" "}
                      {complianceCountries.find(
                        (country) =>
                          country.id ===
                          complianceRouteCountries.originCountryId,
                      )?.name ?? "Not resolved from route"}
                    </p>
                    <p>
                      Destination country:{" "}
                      {complianceCountries.find(
                        (country) =>
                          country.id ===
                          complianceRouteCountries.destinationCountryId,
                      )?.name ?? "Not resolved from route"}
                    </p>
                    <p>
                      Requested horses:{" "}
                      {complianceHorseIds.length
                        ? complianceHorseIds
                            .map((id) => complianceHorseNames[id] ?? "Horse")
                            .join(", ")
                        : "None assigned"}
                    </p>
                    <p>
                      Departure:{" "}
                      {selectedComplianceTrip?.plannedDepartureAt
                        ? new Date(
                            selectedComplianceTrip.plannedDepartureAt,
                          ).toLocaleDateString()
                        : "Not set on trip"}
                    </p>
                  </>
                )}
                {tripContextError && (
                  <p className="blocker" role="alert">
                    {tripContextError}
                  </p>
                )}
              </div>
              <button
                disabled={
                  busy ||
                  tripContextLoading ||
                  !complianceRouteCountries.originCountryId ||
                  !complianceRouteCountries.destinationCountryId ||
                  !complianceHorseIds.length
                }
              >
                {busy ? "Evaluating…" : "Evaluate requirements"}
              </button>
            </form>
            {readiness && (
              <div className="readiness">
                <div>
                  <h3>
                    {readiness.isReady
                      ? "Ready for departure"
                      : "Compliance blockers"}
                  </h3>
                  <p>
                    {readiness.requirements.filter((item) => item.isMet).length}/{readiness.requirements.length}{" "}
                    document requirements met · {readiness.clearances.filter((item) => item.isMet && item.isRequired).length}/{readiness.clearances.filter((item) => item.isRequired).length}{" "}
                    required clearances met
                  </p>
                  {readiness.blockers.map((blocker, index) => (
                      <p className="blocker" key={index}>
                        {blocker}
                      </p>
                    ))}
                </div>
              </div>
            )}
          </ModalDialog>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Border clearance cases</h2>
            <p>
              Browse cases, then open one to review its route, documents, status
              and available actions.
            </p>
          </div>
          <div className="header-actions">
            <span className="result-count">
              {clearances.length} cases found
            </span>
            <button
              className="ghost"
              disabled={clearanceLoading}
              onClick={() => void reloadClearances()}
            >
              {clearanceLoading ? "Refreshing…" : "Refresh"}
            </button>
            {role !== "CUSTOMER" && (
              <button
                disabled={tripChoicesLoading}
                onClick={() => {
                  setComplianceTripId("");
                  setActionOpen("clearance");
                }}
              >
                {tripChoicesLoading ? "Loading trips…" : "+ New border case"}
              </button>
            )}
          </div>
        </div>
        <ListFilters
          query={clearanceQuery}
          status={clearanceStatus}
          statuses={[
            "DRAFT",
            "SUBMITTED",
            "UNDER_REVIEW",
            "NEED_ADDITIONAL_INFO",
            "APPROVED",
            "REJECTED",
            "COMPLETED",
          ]}
          placeholder="Search case, authority, reference or notes…"
          onQueryChange={setClearanceQuery}
          onStatusChange={setClearanceStatus}
          onSearch={() => setClearanceSearch(clearanceQuery.trim())}
          onClear={() => {
            setClearanceQuery("");
            setClearanceSearch("");
            setClearanceStatus("");
            setClearanceCountry("");
          }}
        />
        <div className="table-tools clearance-table-tools">
          <label>
            Country
            <select
              value={clearanceCountry}
              onChange={(event) => setClearanceCountry(event.target.value)}
            >
              <option value="">All countries</option>
              {complianceCountries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select
              value={clearanceSort}
              onChange={(event) => setClearanceSort(event.target.value)}
            >
              <option value="updatedAt">Last updated</option>
              <option value="caseNo">Case number</option>
              <option value="authority">Authority</option>
              <option value="status">Status</option>
            </select>
          </label>
          <label>
            Direction
            <select
              value={clearanceSortDirection}
              onChange={(event) =>
                setClearanceSortDirection(event.target.value as "asc" | "desc")
              }
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
          <div className="clearance-sort-hint">
            The backend applies these filters and sorting before returning
            results.
          </div>
          {(clearanceQuery ||
            clearanceSearch ||
            clearanceStatus ||
            clearanceCountry) && (
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                setClearanceQuery("");
                setClearanceSearch("");
                setClearanceStatus("");
                setClearanceCountry("");
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Case</th>
                <th>Trip</th>
                <th>Country</th>
                <th>Authority</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clearances.map((c) => (
                <tr
                  key={c.id}
                  className="clearance-row"
                  onClick={() => setSelectedClearance(c)}
                >
                  <td>
                    <button
                      className="clearance-case-trigger"
                      onClick={() => setSelectedClearance(c)}
                    >
                      <b>{c.caseNo}</b>
                      <small>
                        Updated{" "}
                        {c.updatedAt
                          ? new Date(c.updatedAt).toLocaleDateString()
                          : "—"}
                      </small>
                    </button>
                  </td>
                  <td>
                    {tripChoices.find((trip) => trip.id === c.tripId)?.tripNo ??
                      "—"}
                  </td>
                  <td>
                    {complianceCountries.find(
                      (country) => country.id === c.countryId,
                    )?.name ?? "Unknown country"}
                  </td>
                  <td>{c.authorityName}</td>
                  <td>
                    <em
                      className={`clearance-status-badge clearance-status-${c.status.toLowerCase()}`}
                    >
                      {c.status.replaceAll("_", " ")}
                    </em>
                  </td>
                  <td>
                    <button
                      className="ghost small"
                      onClick={() => setSelectedClearance(c)}
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
              {!clearances.length && (
                <tr>
                  <td colSpan={6}>
                    {clearanceLoading
                      ? "Loading clearance cases…"
                      : clearanceSearch || clearanceStatus || clearanceCountry
                        ? "No cases match these filters."
                        : "No border clearance cases yet. Create a draft for a cross-border trip to begin."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {selectedClearance && (
        <ActionModal
          title={selectedClearance.caseNo}
          description={`Border clearance · ${selectedClearance.status.replaceAll("_", " ")}`}
          onClose={() => setSelectedClearance(null)}
        >
          <div className="detail-grid">
            {[
              [
                "Trip",
                tripChoices.find((trip) => trip.id === selectedClearance.tripId)
                  ?.tripNo ?? "—",
              ],
              [
                "Country",
                complianceCountries.find(
                  (country) => country.id === selectedClearance.countryId,
                )?.name ?? "Unknown country",
              ],
              ["Authority", selectedClearance.authorityName],
              ["Reference number", selectedClearance.referenceNumber],
              ["Status", selectedClearance.status.replaceAll("_", " ")],
              [
                "Submitted",
                selectedClearance.submittedAt
                  ? new Date(selectedClearance.submittedAt).toLocaleString()
                  : "—",
              ],
              [
                "Reviewed",
                selectedClearance.reviewedAt
                  ? new Date(selectedClearance.reviewedAt).toLocaleString()
                  : "—",
              ],
              [
                "Completed",
                selectedClearance.completedAt
                  ? new Date(selectedClearance.completedAt).toLocaleString()
                  : "—",
              ],
              ["Rejection reason", selectedClearance.rejectionReason],
              ["Notes", selectedClearance.notes],
            ].map(([label, value]) => (
              <div className="detail-field" key={String(label)}>
                <small>{String(label)}</small>
                <b>{String(value || "—")}</b>
              </div>
            ))}
          </div>
          <div className="notice-card">
            <b>Case documents</b>
            {selectedClearance.documents?.length ? (
              selectedClearance.documents.map((doc) => (
                <p key={doc.id}>
                  {doc.documentNo ?? doc.documentTypeName ?? "Document"} ·{" "}
                  {doc.status}
                  {doc.required ? " · Required" : ""}
                </p>
              ))
            ) : (
              <p>No documents are linked to this case.</p>
            )}
          </div>
          <p className="field-help">
            “Complete case” records the end of this internal workflow after
            approval. It does not submit paperwork to a live border authority.
          </p>
          <div className="modal-actions">
            {selectedClearance.status.toUpperCase() === "DRAFT" && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await submitClearanceCase(selectedClearance.id);
                    notify("Case submitted for review.");
                    await reloadClearances();
                  } catch (e) {
                    report(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Submit for review
              </button>
            )}
            {reviewer &&
              selectedClearance.status.toUpperCase() === "SUBMITTED" && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await reviewClearanceCase(
                        selectedClearance.id,
                        "UNDER_REVIEW",
                        "Review started.",
                      );
                      notify("Case moved to review.");
                      await reloadClearances();
                    } catch (e) {
                      report(errorText(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Start review
                </button>
              )}
            {reviewer &&
              selectedClearance.status.toUpperCase() === "UNDER_REVIEW" && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await reviewClearanceCase(
                        selectedClearance.id,
                        "APPROVED",
                        "Approved after review.",
                      );
                      notify("Case approved.");
                      await reloadClearances();
                    } catch (e) {
                      report(errorText(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Approve case
                </button>
              )}
            {reviewer &&
              selectedClearance.status.toUpperCase() === "APPROVED" && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await reviewClearanceCase(
                        selectedClearance.id,
                        "COMPLETED",
                        "Border clearance workflow completed.",
                      );
                      notify("Case marked completed.");
                      await reloadClearances();
                    } catch (e) {
                      report(errorText(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Complete case
                </button>
              )}
            <button
              type="button"
              className="ghost"
              onClick={() => setSelectedClearance(null)}
            >
              Close
            </button>
          </div>
        </ActionModal>
      )}
      {actionOpen === "clearance" && (
        <ActionModal
          title="New border clearance case"
          description="Create an internal draft record for a cross-border trip. This does not send paperwork to a border authority."
          onClose={() => setActionOpen(null)}
        >
          <form className="form-grid" onSubmit={makeClearance}>
            <label>
              Trip
              <select
                name="tripId"
                value={complianceTripId}
                onChange={(event) => setComplianceTripId(event.target.value)}
                required
              >
                <option value="">Choose a trip</option>
                {tripChoices.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.tripNo} · {trip.status}
                  </option>
                ))}
              </select>
              <small className="field-help">
                Creates a draft case for a cross-border trip.
              </small>
            </label>
            <div>
              <small>Route leg destination country</small>
              <b>
                {selectedClearanceRouteLeg?.destinationCountryId
                  ? (complianceCountries.find(
                      (country) =>
                        country.id ===
                        selectedClearanceRouteLeg.destinationCountryId,
                    )?.name ?? "Country unavailable")
                  : tripContextLoading
                    ? "Loading trip route…"
                    : "Choose a route leg first"}
              </b>
              <select
                name="routeLegId"
                value={selectedClearanceRouteLegId}
                onChange={(event) => setSelectedClearanceRouteLegId(event.target.value)}
                required
              >
                <option value="">Choose a route leg</option>
                {complianceRouteLegs.map((leg, index) => (
                  <option key={leg.routeLegId} value={leg.routeLegId}>
                    Leg {index + 1}: {complianceCountries.find((country) => country.id === leg.originCountryId)?.name ?? "Origin"} → {complianceCountries.find((country) => country.id === leg.destinationCountryId)?.name ?? "Destination"}
                  </option>
                ))}
              </select>
              <input
                type="hidden"
                name="countryId"
                value={selectedClearanceRouteLeg?.destinationCountryId ?? ""}
              />
            </div>
            <label>
              Clearance type
              <select name="clearanceType" defaultValue="CUSTOMS" required>
                <option value="CUSTOMS">Customs</option>
                <option value="QUARANTINE">Quarantine</option>
                <option value="INSPECTION">Inspection</option>
              </select>
            </label>
            <label>
              Authority name
              <input name="authorityName" required />
            </label>
            <label>
              Reference number
              <input name="referenceNumber" />
            </label>
            <label className="span-2">
              Notes
              <input name="notes" />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setActionOpen(null)}
              >
                Cancel
              </button>
              <button
                disabled={
                  busy ||
                  tripContextLoading ||
                  !selectedClearanceRouteLeg
                }
              >
                {busy ? "Creating…" : "Create draft case"}
              </button>
            </div>
          </form>
        </ActionModal>
      )}
    </div>
  );
}
function StaffRouteCountriesModal({
  user,
  countries,
  report,
  notify,
  onClose,
  onSaved,
}: {
  user: StaffAccount;
  countries: RecordRow[];
  report: (message: string) => void;
  notify: (message: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [countryIds, setCountryIds] = useState<string[]>([]);
  const [validUntil, setValidUntil] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getStaffRouteCountries(user.id)
      .then((rows) => {
        setCountryIds(rows.map((row) => row.countryId));
        setValidUntil(
          rows.find((row) => row.validUntil)?.validUntil?.slice(0, 10) ?? "",
        );
      })
      .catch((error) => report(errorText(error)))
      .finally(() => setLoading(false));
  }, [user.id, report]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    report("");
    try {
      await saveStaffRouteCountries(user.id, {
        countryIds,
        validUntil: validUntil || null,
      });
      notify(`Approved route countries updated for ${user.fullName}.`);
      onSaved();
      onClose();
    } catch (error) {
      report(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ActionModal
      title={`Driver route countries · ${user.fullName}`}
      description="Select every country this driver is approved to operate in. The assignment API checks the entire route leg and its scheduled end date."
      onClose={onClose}
    >
      {loading ? (
        <p className="modal-loading">Loading approved countries…</p>
      ) : (
        <form className="form-grid" onSubmit={save}>
          <div className="span-2">
            <b>Approved countries</b>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
                marginTop: 10,
              }}
            >
              {countries
                .filter((country) => country.active !== false)
                .map((country) => {
                  const id = String(country.id);
                  return (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked={countryIds.includes(id)}
                        onChange={(event) =>
                          setCountryIds((current) =>
                            event.target.checked
                              ? [...current, id]
                              : current.filter((value) => value !== id),
                          )
                        }
                      />
                      {String(country.name ?? country.isoCode ?? id)}
                    </label>
                  );
                })}
            </div>
            <small className="field-help">
              No countries selected means this account cannot be assigned as a
              driver.
            </small>
          </div>
          <label>
            Approval valid through (optional)
            <input
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
            />
          </label>
          <div className="modal-actions span-2">
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button disabled={busy}>
              {busy ? "Saving…" : "Save route eligibility"}
            </button>
          </div>
        </form>
      )}
    </ActionModal>
  );
}

function StaffOperatingAreasModal({
  user,
  locations,
  countries,
  report,
  notify,
  onClose,
  onSaved,
}: {
  user: StaffAccount;
  locations: RecordRow[];
  countries: RecordRow[];
  report: (s: string) => void;
  notify: (s: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [areas, setAreas] = useState<
    { locationId: string; radiusKm: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const usableLocations = locations.filter(
    (location) =>
      String(location.active).toLowerCase() !== "false" &&
      location.latitude != null &&
      location.longitude != null,
  );

  useEffect(() => {
    getStaffOperatingAreas(user.id)
      .then((rows) =>
        setAreas(
          rows.map((area) => ({
            locationId: area.locationId,
            radiusKm: String(area.radiusKm),
          })),
        ),
      )
      .catch((error) => report(errorText(error)));
  }, [user.id]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await saveStaffOperatingAreas(
        user.id,
        areas.map((area) => ({
          locationId: area.locationId,
          radiusKm: Number(area.radiusKm),
        })),
      );
      notify(`Operating areas updated for ${user.fullName}.`);
      onSaved();
      onClose();
    } catch (error) {
      report(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ActionModal
      title={`Operating areas · ${user.fullName}`}
      description="Choose the regions this driver serves. A dispatch pickup must fall inside an area to qualify."
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={save}>
        {areas.map((area, index) => (
          <div className="form-grid span-2" key={`${area.locationId}-${index}`}>
            <label>
              Area center
              <select
                value={area.locationId}
                onChange={(event) =>
                  setAreas((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, locationId: event.target.value }
                        : item,
                    ),
                  )
                }
                required
              >
                <option value="">Choose a registered location</option>
                {usableLocations.map((location) => {
                  const country = countries.find(
                    (item) => String(item.id) === String(location.countryId),
                  );
                  return (
                    <option key={location.id} value={String(location.id)}>
                      {String(location.city || location.name)} ·{" "}
                      {String(country?.name ?? "Country not set")}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Service radius (km)
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                value={area.radiusKm}
                onChange={(event) =>
                  setAreas((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, radiusKm: event.target.value }
                        : item,
                    ),
                  )
                }
                required
              />
            </label>
            <button
              type="button"
              className="ghost small"
              onClick={() =>
                setAreas((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              Remove area
            </button>
          </div>
        ))}
        {!usableLocations.length && (
          <p className="field-help span-2">
            No active locations with map coordinates are available. Add
            coordinates to the location directory first.
          </p>
        )}
        <button
          type="button"
          className="ghost small"
          disabled={areas.length >= 20 || !usableLocations.length}
          onClick={() =>
            setAreas((current) => [
              ...current,
              { locationId: "", radiusKm: "100" },
            ])
          }
        >
          Add operating area
        </button>
        <p className="field-help span-2">
          Only active locations with latitude/longitude can anchor an area. The
          pickup must be within the selected radius.
        </p>
        <div className="modal-actions span-2">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy}>
            {busy ? "Saving…" : "Save operating areas"}
          </button>
        </div>
      </form>
    </ActionModal>
  );
}

function RouteTemplateCreator({
  locations,
  onClose,
  onSaved,
}: {
  locations: RecordRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<"ROAD" | "AIR">("ROAD");
  const [points, setPoints] = useState<RouteShapePoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const label = (location: RecordRow) =>
    `${location.name}${location.city ? ` · ${location.city}` : ""}${location.address ? ` · ${location.address}` : ""}`;
  const choices = locations.filter(
    (location) =>
      location.active !== false &&
      location.latitude != null &&
      location.longitude != null,
  );
  const start = choices.find((location) => location.id === origin);
  const end = choices.find((location) => location.id === destination);
  const waypoints: RouteWaypoint[] =
    start && end && origin !== destination
      ? [
          {
            id: start.id,
            label: label(start),
            kind: "pickup",
            latitude: Number(start.latitude),
            longitude: Number(start.longitude),
          },
          {
            id: end.id,
            label: label(end),
            kind: "delivery",
            latitude: Number(end.latitude),
            longitude: Number(end.longitude),
          },
        ]
      : [];
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!start || !end || origin === destination) {
      setError("Choose two different locations with coordinates.");
      return;
    }
    setSaving(true);
    try {
      await createRouteTemplate({
        name: name.trim(),
        originLocationId: origin,
        destinationLocationId: destination,
        transportMode: mode,
        points,
      });
      onSaved();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setSaving(false);
    }
  }
  return (
    <ActionModal
      title="Create route template"
      description="Prepare a reusable route between saved locations."
      onClose={onClose}
      className="trip-management-modal"
    >
      <form className="form-grid" onSubmit={(event) => void save(event)}>
        <label>
          Template name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
          />
        </label>
        <label>
          Transport mode
          <select
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as "ROAD" | "AIR");
              setPoints([]);
            }}
          >
            <option value="ROAD">Road</option>
            <option value="AIR">Air</option>
          </select>
        </label>
        <label>
          From
          <select
            value={origin}
            onChange={(event) => {
              setOrigin(event.target.value);
              setPoints([]);
            }}
            required
          >
            <option value="">Choose origin</option>
            {choices.map((location) => (
              <option key={location.id} value={location.id}>
                {label(location)}
              </option>
            ))}
          </select>
        </label>
        <label>
          To
          <select
            value={destination}
            onChange={(event) => {
              setDestination(event.target.value);
              setPoints([]);
            }}
            required
          >
            <option value="">Choose destination</option>
            {choices.map((location) => (
              <option key={location.id} value={location.id}>
                {label(location)}
              </option>
            ))}
          </select>
        </label>
        <div className="span-2">
          {waypoints.length ? (
            <OsmRouteMap
              waypoints={waypoints}
              mode={mode}
              shapePoints={points}
              editable
              onShapeChange={setPoints}
            />
          ) : (
            <p className="field-help">
              Choose two locations with coordinates to edit the route.
            </p>
          )}
          <p className="field-help">
            This template saves map points. Add operational checkpoints
            separately on each trip.
          </p>
        </div>
        {error && (
          <p className="auth-error span-2" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button disabled={saving || !waypoints.length || !name.trim()}>
            {saving ? "Saving…" : "Save template"}
          </button>
        </div>
      </form>
    </ActionModal>
  );
}

function RouteTemplatesView({
  report,
  notify,
}: {
  report: (s: string) => void;
  notify: (s: string) => void;
}) {
  const [templates, setTemplates] = useState<RouteTemplate[]>([]);
  const [locations, setLocations] = useState<RecordRow[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<RouteTemplate | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, places] = await Promise.all([
        getRouteTemplates(),
        getRows("locations"),
      ]);
      setTemplates(rows);
      setLocations(places);
    } catch (error) {
      report(errorText(error));
    } finally {
      setLoading(false);
    }
  }, [report]);
  useEffect(() => {
    void load();
  }, [load]);
  const label = (id: string) => {
    const place = locations.find((item) => item.id === id);
    return place
      ? [place.name, place.city].filter(Boolean).join(" · ")
      : "Location unavailable";
  };
  const visible = templates.filter(
    (item) =>
      (!mode || item.transportMode === mode) &&
      `${item.name} ${label(item.originLocationId)} ${label(item.destinationLocationId)}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const start =
    preview && locations.find((item) => item.id === preview.originLocationId);
  const end =
    preview &&
    locations.find((item) => item.id === preview.destinationLocationId);
  const waypoints: RouteWaypoint[] =
    start &&
    end &&
    start.latitude != null &&
    start.longitude != null &&
    end.latitude != null &&
    end.longitude != null
      ? [
          ...(preview?.customPickupLatitude != null &&
          preview.customPickupLongitude != null
            ? [
                {
                  id: "custom-pickup",
                  label: "Custom pickup",
                  kind: "pickup" as const,
                  latitude: preview.customPickupLatitude,
                  longitude: preview.customPickupLongitude,
                },
              ]
            : []),
          {
            id: start.id,
            label: label(start.id),
            kind: "pickup",
            latitude: Number(start.latitude),
            longitude: Number(start.longitude),
          },
          {
            id: end.id,
            label: label(end.id),
            kind: "delivery",
            latitude: Number(end.latitude),
            longitude: Number(end.longitude),
          },
        ]
      : [];
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>Route templates</h2>
          <p>Create and reuse planned routes when preparing a trip.</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </button>
          <button type="button" onClick={() => setCreating(true)}>
            + Route template
          </button>
        </div>
      </div>
      <div className="trip-browser">
        <label>
          Search
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Template name, origin or destination"
          />
        </label>
        <label>
          Transport mode
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="">All modes</option>
            <option value="ROAD">Road</option>
            <option value="AIR">Air</option>
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Template</th>
              <th>From</th>
              <th>To</th>
              <th>Mode</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.name}</b>
                </td>
                <td>{label(item.originLocationId)}</td>
                <td>{label(item.destinationLocationId)}</td>
                <td>{item.transportMode}</td>
                <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setPreview(item)}
                  >
                    View route
                  </button>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={6}>
                  {loading
                    ? "Loading route templates…"
                    : "No route templates found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="field-help">
        {visible.length} template(s). Templates appear in a draft when the
        locations and transport mode match.
      </p>
      {creating && (
        <RouteTemplateCreator
          locations={locations}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            notify("Route template saved.");
            void load();
          }}
        />
      )}
      {preview && (
        <ActionModal
          title={preview.name}
          description={`${label(preview.originLocationId)} → ${label(preview.destinationLocationId)} · ${preview.transportMode}`}
          className="trip-management-modal"
          onClose={() => setPreview(null)}
        >
          {waypoints.length ? (
            <OsmRouteMap
              waypoints={waypoints}
              mode={preview.transportMode}
              shapePoints={preview.points}
            />
          ) : (
            <p>Map coordinates are unavailable for this route.</p>
          )}
        </ActionModal>
      )}
    </section>
  );
}

function TripsView({
  role,
  report,
  notify,
  focusTripId,
  focusHorseOptions,
  onFocusHandled,
}: {
  role: string;
  report: (s: string) => void;
  notify: (s: string) => void;
  focusTripId: string;
  focusHorseOptions: { id: string; label: string }[];
  onFocusHandled: () => void;
}) {
  const canPlanRoute = [
    "TRANSPORT_SPECIALIST",
    "FLEET_ROUTE_COORDINATOR",
    "ADMIN",
  ].includes(role);
  const canReviewRoute = ["LOGISTICS_MANAGER", "ADMIN"].includes(role);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [tripSearch, setTripSearch] = useState("");
  const [tripStatus, setTripStatus] = useState("");
  const [tripSort, setTripSort] = useState("departure");
  const [tripSortDirection, setTripSortDirection] = useState<"asc" | "desc">(
    "desc",
  );
  const [tripOptions, setTripOptions] = useState<Trip[]>([]);
  const [tripListLoading, setTripListLoading] = useState(false);
  const [tripPagination, setTripPagination] =
    useState<PaginationMeta>(emptyPagination);
  const [tripOrders, setTripOrders] = useState<TripOrder[]>([]);
  const [dispatchMonth, setDispatchMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [dispatchDays, setDispatchDays] = useState<DispatchCalendarDay[]>([]);
  const [dispatchDate, setDispatchDate] = useState("");
  const [dispatchOrders, setDispatchOrders] = useState<TripOrder[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [calendarQuery, setCalendarQuery] = useState("");
  const [calendarSearchMessage, setCalendarSearchMessage] = useState("");
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [versions, setVersions] = useState<RouteVersion[]>([]);
  const [version, setVersion] = useState<RouteVersion | null>(null);
  const [legs, setLegs] = useState<RecordRow[]>([]);
  const [readiness, setReadiness] = useState<{
    ready: boolean;
    blockers: string[];
  } | null>(null);
  const [routeEditing, setRouteEditing] = useState(false);
  const [draftRouteShape, setDraftRouteShape] = useState<RouteShapePoint[]>([]);
  const [routeTemplates, setRouteTemplates] = useState<RouteTemplate[]>([]);
  const [routeTemplateId, setRouteTemplateId] = useState("");
  const [routeTemplateReload, setRouteTemplateReload] = useState(0);
  const [routeTemplateSaveOpen, setRouteTemplateSaveOpen] = useState(false);
  const [tripClearanceCases, setTripClearanceCases] = useState<ClearanceCase[]>(
    [],
  );
  const [clearanceLeg, setClearanceLeg] = useState<RecordRow | null>(null);
  const [assignments, setAssignments] = useState<{
    resources: RecordRow[];
    staff: RecordRow[];
    horses: RecordRow[];
  }>({ resources: [], staff: [], horses: [] });
  const [checkpoints, setCheckpoints] = useState<RecordRow[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<RecordRow[]>([]);
  const [flightBookings, setFlightBookings] = useState<RecordRow[]>([]);
  const [fleetStalls, setFleetStalls] = useState<RecordRow[]>([]);
  const [routeLocations, setRouteLocations] = useState<RecordRow[]>([]);
  const [routeCountries, setRouteCountries] = useState<RecordRow[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<StaffAccount[]>([]);
  const [staffRole, setStaffRole] = useState<"DRIVER" | "ESCORT">("DRIVER");
  const [staffUserId, setStaffUserId] = useState("");
  const [staffCoverageOpen, setStaffCoverageOpen] = useState(false);
  const [staffAreasOpen, setStaffAreasOpen] = useState(false);
  const [requestHorseOptions, setRequestHorseOptions] = useState<
    { id: string; label: string }[]
  >([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [tripForm, setTripForm] = useState<
    | "new-version"
    | "checkpoint"
    | "resource"
    | "staff"
    | "horse"
    | "schedule"
    | null
  >(null);
  const [assignmentLegId, setAssignmentLegId] = useState("");
  useEffect(() => {
    setRouteEditing(false);
    setRouteTemplateId("");
  }, [selectedId, version?.id, legs[0]?.id]);
  useEffect(() => {
    const leg = legs[0];
    if (
      !canPlanRoute ||
      !trip ||
      !leg ||
      version?.status.toUpperCase() !== "DRAFT"
    ) {
      setRouteTemplates([]);
      return;
    }
    let cancelled = false;
    getRouteTemplates(
      String(leg.originLocationId),
      String(leg.destinationLocationId),
      String(leg.transportMode),
      trip?.customPickupLatitude,
      trip?.customPickupLongitude,
    )
      .then((items) => {
        if (!cancelled) setRouteTemplates(items);
      })
      .catch((error) => {
        if (!cancelled) report(errorText(error));
      });
    return () => {
      cancelled = true;
    };
  }, [
    canPlanRoute,
    legs[0]?.id,
    legs[0]?.originLocationId,
    legs[0]?.destinationLocationId,
    legs[0]?.transportMode,
    version?.status,
    trip?.id,
    trip?.customPickupLatitude,
    trip?.customPickupLongitude,
    routeTemplateReload,
    report,
  ]);
  const canAssignRoute =
    canPlanRoute &&
    ["DRAFT", "ACTIVE"].includes(version?.status.toUpperCase() ?? "");
  useEffect(() => {
    if (focusTripId) {
      setSelectedId(focusTripId);
      setRequestHorseOptions(focusHorseOptions);
      onFocusHandled();
    }
  }, [focusTripId]);
  useEffect(() => {
    let cancelled = false;
    setTripListLoading(true);
    if (canPlanRoute && !dispatchDate) {
      setTripOptions([]);
      setTripPagination((p) => ({ ...p, totalItems: 0, totalPages: 0 }));
      setTripListLoading(false);
      return;
    }
    getTrips(
      tripPagination.page,
      tripPagination.pageSize,
      tripSearch,
      tripStatus,
      tripSort,
      tripSortDirection,
      canPlanRoute ? dispatchDate : "",
    )
      .then((result) => {
        if (!cancelled) {
          setTripOptions(result.data);
          setTripPagination(result.pagination);
        }
      })
      .catch((e) => {
        if (!cancelled) report(errorText(e));
      })
      .finally(() => {
        if (!cancelled) setTripListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    tripPagination.page,
    tripPagination.pageSize,
    tripSearch,
    tripStatus,
    tripSort,
    tripSortDirection,
    report,
    canPlanRoute,
    dispatchDate,
  ]);
  useEffect(() => {
    if (!canPlanRoute) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const query = calendarQuery.trim();
      setTripSearch(query);
      setTripPagination((p) => ({ ...p, page: 0 }));
      setCalendarSearchMessage("");
      if (!query) return;
      try {
        const [result, orders] = await Promise.all([
          getTrips(0, 1, query, tripStatus, "departure", "desc"),
          tripStatus
            ? Promise.resolve<TripOrder[]>([])
            : searchDispatchOrders(query),
        ]);
        if (cancelled) return;
        const tripDeparture = result.data[0]?.plannedDepartureAt;
        const orderDeparture = orders[0]?.requestedDepartureAt;
        const departure =
          tripDeparture && orderDeparture
            ? tripDeparture >= orderDeparture
              ? tripDeparture
              : orderDeparture
            : tripDeparture || orderDeparture;
        if (!departure) {
          setDispatchDate("");
          setCalendarSearchMessage(
            result.data.length
              ? "The matching trip has no scheduled departure date."
              : "No trips or unassigned orders match this search.",
          );
          return;
        }
        const date = departure.slice(0, 10);
        const [year, month] = date.split("-").map(Number);
        setDispatchMonth(new Date(year, month - 1, 1));
        setDispatchDate(date);
        if (
          result.pagination.totalItems > 1 ||
          (tripDeparture && orderDeparture)
        )
          setCalendarSearchMessage(
            "Showing the latest matching departure; select another date to explore.",
          );
      } catch (error) {
        if (!cancelled) report(errorText(error));
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [calendarQuery, canPlanRoute, report, tripStatus]);
  useEffect(() => {
    Promise.all([
      getRows("vehicles"),
      getRows("flight-bookings"),
      getRows("stalls"),
      getRows("locations"),
      getRows("countries"),
    ])
      .then(([vehicles, flights, stalls, locations, countries]) => {
        setFleetVehicles(vehicles);
        setFlightBookings(flights);
        setFleetStalls(stalls);
        setRouteLocations(locations);
        setRouteCountries(countries);
      })
      .catch((e) => report(errorText(e)));
  }, [report]);
  useEffect(() => {
    getStaffDirectory()
      .then(setStaffDirectory)
      .catch((e) => report(errorText(e)));
  }, [report]);
  useEffect(() => {
    if (!canPlanRoute) return;
    getDispatchCalendar(
      dispatchMonth.getFullYear(),
      dispatchMonth.getMonth() + 1,
    )
      .then(setDispatchDays)
      .catch((e) => report(errorText(e)));
  }, [canPlanRoute, dispatchMonth, report]);
  useEffect(() => {
    if (!dispatchDate || !canPlanRoute) {
      setDispatchOrders([]);
      return;
    }
    let cancelled = false;
    setDispatchLoading(true);
    setDispatchOrders([]);
    setSelectedOrderIds([]);
    getDispatchOrders(dispatchDate)
      .then((rows) => {
        if (!cancelled) setDispatchOrders(rows);
      })
      .catch((e) => {
        if (!cancelled) report(errorText(e));
      })
      .finally(() => {
        if (!cancelled) setDispatchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatchDate, canPlanRoute, report]);
  const refreshTrips = useCallback(async () => {
    if (!selectedId) return;
    try {
      setTrip(await getTrip(selectedId));
    } catch (e) {
      report(errorText(e));
    }
  }, [selectedId, report]);
  const loadTrip = useCallback(async () => {
    if (!selectedId) {
      setPlan(null);
      setVersions([]);
      setLegs([]);
      setReadiness(null);
      setAssignments({ resources: [], staff: [], horses: [] });
      setCheckpoints([]);
      setTripOrders([]);
      return;
    }
    try {
      setPlan(null);
      setVersions([]);
      setVersion(null);
      setTrip(null);
      const [t, orderRows] = await Promise.all([
        getTrip(selectedId),
        getTripOrders(selectedId),
      ]);
      setTrip(t);
      setTripOrders(orderRows);
      const requestedHorseIds = [
        ...new Set(orderRows.flatMap((order) => order.horseIds ?? [])),
      ];
      setRequestHorseOptions(
        requestedHorseIds.map((id) => ({
          id,
          label:
            orderRows.map((order) => order.horseNames?.[id]).find(Boolean) ??
            `Horse ${id.slice(0, 8)}`,
        })),
      );
      const [r, a] = await Promise.all([
        getReadiness(selectedId),
        getAssignments(selectedId),
      ]);
      setAssignments(a);
      setReadiness(r);
      let routePlan: RoutePlan | null = null;
      try {
        routePlan = await getRoutePlanByTrip(selectedId);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
      setPlan(routePlan);
      if (routePlan) {
        const routeVersions = await getVersions(routePlan.id);
        setVersions(routeVersions);
        const selectedVersion =
          routeVersions.find(
            (item) => item.id === routePlan?.activeVersionId,
          ) ??
          routeVersions.at(-1) ??
          null;
        setVersion(selectedVersion);
        const routeLegs = selectedVersion
          ? await getLegs(selectedVersion.id)
          : [];
        setLegs(routeLegs);
        setCheckpoints(
          routeLegs[0] ? await getCheckpoints(routeLegs[0].id) : [],
        );
      } else {
        setVersions([]);
        setVersion(null);
        setLegs([]);
        setCheckpoints([]);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setTrip(null);
        setPlan(null);
        setVersions([]);
        setLegs([]);
      } else report(errorText(e));
    }
  }, [selectedId, report]);
  useEffect(() => {
    if (selectedId) void loadTrip();
  }, [loadTrip, selectedId]);
  useEffect(() => {
    if (!selectedId) {
      setTripClearanceCases([]);
      return;
    }
    let cancelled = false;
    getClearanceCases(selectedId)
      .then((rows) => {
        if (!cancelled) setTripClearanceCases(rows);
      })
      .catch((e) => {
        if (!cancelled) report(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, report]);
  const visibleTrips = tripOptions;
  const readinessTarget = (blocker: string) => {
    if (!plan) return "trip-create-plan";
    if (!legs.length) return "trip-route";
    const value = blocker.toLowerCase();
    if (value.includes("horse") || value.includes("stall"))
      return "trip-resources";
    if (
      value.includes("staff") ||
      value.includes("driver") ||
      value.includes("escort")
    )
      return "trip-resources";
    if (
      value.includes("vehicle") ||
      value.includes("flight") ||
      value.includes("resource")
    )
      return "trip-resources";
    if (
      value.includes("route") ||
      value.includes("leg") ||
      value.includes("checkpoint")
    )
      return "trip-route";
    return "trip-readiness";
  };
  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    report("");
    try {
      await fn();
      notify(message);
      if (selectedId) {
        await refreshTrips();
        await loadTrip();
      }
      return true;
    } catch (e) {
      report(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function onAddCheckpoint(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const leg = legs[0];
    if (!leg) return;
    const f = new FormData(e.currentTarget);
    const succeeded = await run(
      () =>
        addCheckpoint(leg.id, {
          sequenceNo: checkpoints.length + 1,
          locationId: f.get("locationId"),
          type: f.get("type") || "CHECKPOINT",
        }),
      "Checkpoint added. The OSM route now passes through it.",
    );
    if (succeeded) {
      setTripForm(null);
      e.currentTarget.reset();
    }
  }
  async function saveBorderCase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trip || !clearanceLeg) return;
    const form = new FormData(e.currentTarget);
    const succeeded = await run(async () => {
      await createClearanceCase({
        tripId: trip.id,
        routeLegId: clearanceLeg.id,
        countryId: String(form.get("countryId") || ""),
        clearanceType: String(form.get("clearanceType") || "CUSTOMS") as "CUSTOMS" | "QUARANTINE" | "INSPECTION",
        authorityName: String(form.get("authorityName") || ""),
        referenceNumber: String(form.get("referenceNumber") || ""),
        notes: String(form.get("notes") || ""),
      });
      setTripClearanceCases(await getClearanceCases(trip.id));
      setClearanceLeg(null);
    }, "Border clearance case created.");
    if (succeeded) e.currentTarget.reset();
  }
  async function selectVersion(id: string) {
    const selectedVersion = versions.find((item) => item.id === id) ?? null;
    setVersion(selectedVersion);
    try {
      const routeLegs = selectedVersion
        ? await getLegs(selectedVersion.id)
        : [];
      setLegs(routeLegs);
      setCheckpoints(routeLegs[0] ? await getCheckpoints(routeLegs[0].id) : []);
    } catch (e) {
      report(errorText(e));
    }
  }
  const locationLabel = (row: RecordRow) =>
    `${row.name}${row.city ? ` · ${row.city}` : ""}${row.address ? ` · ${row.address}` : ""}`;
  const routeMapLocation = (
    locationId: string,
    kind: RouteWaypoint["kind"],
  ): RouteWaypoint => {
    const location = routeLocations.find((item) => item.id === locationId);
    const country =
      location &&
      routeCountries.find(
        (item) => item.id === String(location.countryId ?? ""),
      );
    return {
      id: `${kind}-${locationId}`,
      label: location
        ? `${locationLabel(location)}${country?.name ? ` · ${country.name}` : ""}`
        : locationId,
      latitude:
        location?.latitude == null ? undefined : Number(location.latitude),
      longitude:
        location?.longitude == null ? undefined : Number(location.longitude),
      kind,
    };
  };
  const routeMapWaypoints: RouteWaypoint[] =
    trip?.customPickupLatitude != null &&
    trip?.customPickupLongitude != null &&
    trip.destinationLocationId
      ? [
          {
            id: "customer-pickup",
            label: trip.customPickupLabel || "Customer pickup",
            kind: "pickup",
            latitude: trip.customPickupLatitude,
            longitude: trip.customPickupLongitude,
          },
          routeMapLocation(String(trip.originLocationId), "checkpoint"),
          routeMapLocation(String(trip.destinationLocationId), "delivery"),
        ]
      : legs[0]
        ? [
            routeMapLocation(String(legs[0].originLocationId), "pickup"),
            ...[...checkpoints]
              .sort(
                (a, b) => Number(a.sequenceNo ?? 0) - Number(b.sequenceNo ?? 0),
              )
              .map((point) =>
                routeMapLocation(String(point.locationId), "checkpoint"),
              ),
            routeMapLocation(String(legs[0].destinationLocationId), "delivery"),
          ]
        : [];
  const savedRouteShape =
    (legs[0] as unknown as { routeShape?: RouteShapePoint[] } | undefined)
      ?.routeShape ?? emptyRouteShape;
  async function saveEditedRoute() {
    if (!legs[0] || !canPlanRoute || version?.status.toUpperCase() !== "DRAFT")
      return;
    const legId = legs[0].id;
    setBusy(true);
    report("");
    try {
      const updated = await saveRouteShape(legId, draftRouteShape);
      setLegs((current) =>
        current.map((leg) => (leg.id === legId ? updated : leg)),
      );
      setRouteEditing(false);
      notify("Route points saved to the draft plan.");
    } catch (error) {
      report(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function saveCurrentRouteTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!legs[0] || version?.status.toUpperCase() !== "DRAFT") return;
    const name = String(
      new FormData(event.currentTarget).get("name") || "",
    ).trim();
    if (!name) return;
    setBusy(true);
    report("");
    try {
      const template = await createRouteTemplate({
        name,
        originLocationId: String(legs[0].originLocationId),
        destinationLocationId: String(legs[0].destinationLocationId),
        transportMode: String(legs[0].transportMode),
        points: routeEditing ? draftRouteShape : savedRouteShape,
        customPickupLatitude: trip?.customPickupLatitude,
        customPickupLongitude: trip?.customPickupLongitude,
      });
      setRouteTemplateId(template.id);
      setRouteTemplateReload((value) => value + 1);
      setRouteTemplateSaveOpen(false);
      notify("Route template saved.");
    } catch (error) {
      report(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  const borderCountryForLeg = (leg: RecordRow) => {
    const origin = routeLocations.find(
      (item) => item.id === String(leg.originLocationId),
    );
    const destination = routeLocations.find(
      (item) => item.id === String(leg.destinationLocationId),
    );
    const originCountryId = String(origin?.countryId ?? "");
    const destinationCountryId = String(destination?.countryId ?? "");
    return originCountryId &&
      destinationCountryId &&
      originCountryId !== destinationCountryId
      ? destinationCountryId
      : "";
  };
  const resourceLabel = (row: RecordRow) =>
    `${row.vehicleCode ?? row.bookingReference ?? row.id}${row.plateNumber ? ` · ${row.plateNumber}` : ""}${row.flightNumber ? ` · ${row.flightNumber}` : ""}`;
  const createSelectedDispatchTrip = async () => {
    setBusy(true);
    try {
      const result = await createDispatchTrip(selectedOrderIds);
      setSelectedOrderIds([]);
      setSelectedId(result.trip.id);
      setDispatchOrders((rows) =>
        rows.filter((row) => !selectedOrderIds.includes(row.orderId)),
      );
      setDispatchDays(
        await getDispatchCalendar(
          dispatchMonth.getFullYear(),
          dispatchMonth.getMonth() + 1,
        ),
      );
      const page = await getTrips(
        tripPagination.page,
        tripPagination.pageSize,
        tripSearch,
        tripStatus,
        tripSort,
        tripSortDirection,
        canPlanRoute ? dispatchDate : "",
      );
      setTripOptions(page.data);
      setTripPagination(page.pagination);
      notify(
        `${result.orders.length} order(s) scheduled on ${result.trip.tripNo}.`,
      );
    } catch (error) {
      report(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const dispatchCalendarCells = (() => {
    const start = new Date(
      dispatchMonth.getFullYear(),
      dispatchMonth.getMonth(),
      1,
    );
    const gridStart = new Date(start);
    gridStart.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  })();
  const dispatchDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const dispatchDayMap = new Map(
    dispatchDays.map((day) => [day.date.slice(0, 10), day]),
  );
  const assignmentLeg =
    legs.find((leg) => String(leg.id) === assignmentLegId) ?? legs[0];
  const availableLegFlights = assignmentLeg
    ? flightBookings.filter((flight) => {
        if (
          String(flight.confirmationStatus).toUpperCase() !== "CONFIRMED" ||
          String(flight.originAirportId) !==
            String(assignmentLeg.originLocationId) ||
          String(flight.destinationAirportId) !==
            String(assignmentLeg.destinationLocationId)
        )
          return false;
        const departure = assignmentLeg.plannedDepartureAt
          ? utcDate(assignmentLeg.plannedDepartureAt).getTime()
          : null;
        const arrival = assignmentLeg.plannedArrivalAt
          ? utcDate(assignmentLeg.plannedArrivalAt).getTime()
          : null;
        return (
          (departure === null ||
            utcDate(flight.scheduledDepartureAt).getTime() >= departure) &&
          (arrival === null ||
            utcDate(flight.scheduledArrivalAt).getTime() <= arrival)
        );
      })
    : [];
  const legHorseAssignments = assignmentLeg
    ? assignments.horses.filter(
        (item) => String(item.routeLegId) === String(assignmentLeg.id),
      )
    : [];
  async function autoAssignNearestDriver() {
    if (!assignmentLeg) return;
    setBusy(true);
    report("");
    try {
      const candidates = await getNearestDrivers(assignmentLeg.id);
      const candidate = candidates.find((item) =>
        staffDirectory.some(
          (member) =>
            member.id === item.userId &&
            (member.role === "DRIVER" || member.role === "DRIVER_ESCORT"),
        ),
      );
      if (!candidate)
        throw new Error(
          "No recent, available driver has valid country coverage for this leg. Configure a driver operating area or review country approvals.",
        );
      await assignStaff(selectedId, {
        legId: assignmentLeg.id,
        userId: candidate.userId,
        role: "DRIVER",
      });
      const member = staffDirectory.find(
        (item) => item.id === candidate.userId,
      );
      notify(
        `${member?.fullName ?? "Nearest eligible driver"} assigned · ${candidate.distanceKm.toFixed(1)} km from pickup.`,
      );
      setTripForm(null);
      await refreshTrips();
      await loadTrip();
    } catch (error) {
      report(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <section className="panel trip-dashboard">
        <div className="panel-title">
          <div>
            <h2>Trip dashboard</h2>
            <p>
              Search, sort and manage trips. Open a trip to view its route,
              assignments and readiness.
            </p>
          </div>
          <div className="header-actions">
            <button
              className="ghost"
              disabled={tripListLoading}
              onClick={async () => {
                setTripListLoading(true);
                try {
                  const [result, calendar] = await Promise.all([
                    getTrips(
                      tripPagination.page,
                      tripPagination.pageSize,
                      tripSearch,
                      tripStatus,
                      tripSort,
                      tripSortDirection,
                      canPlanRoute ? dispatchDate : "",
                    ),
                    canPlanRoute
                      ? getDispatchCalendar(
                          dispatchMonth.getFullYear(),
                          dispatchMonth.getMonth() + 1,
                        )
                      : Promise.resolve<DispatchCalendarDay[] | null>(null),
                  ]);
                  setTripOptions(result.data);
                  setTripPagination(result.pagination);
                  if (calendar) setDispatchDays(calendar);
                  if (canPlanRoute && dispatchDate)
                    setDispatchOrders(await getDispatchOrders(dispatchDate));
                  if (selectedId) {
                    await refreshTrips();
                    await loadTrip();
                  }
                } catch (e) {
                  report(errorText(e));
                } finally {
                  setTripListLoading(false);
                }
              }}
            >
              {tripListLoading ? "Refreshing…" : "Refresh trips"}
            </button>
          </div>
        </div>
        <div className="kpi-grid trip-kpis">
          <article className="kpi-card">
            <small>Matching trips</small>
            <strong>{tripPagination.totalItems}</strong>
            <span>Across all matching pages</span>
          </article>
          <article className="kpi-card">
            <small>Planned on this page</small>
            <strong>
              {
                tripOptions.filter(
                  (item) => item.status.toUpperCase() === "PLANNED",
                ).length
              }
            </strong>
            <span>Awaiting route or assignments</span>
          </article>
          <article className="kpi-card">
            <small>Ready on this page</small>
            <strong>
              {
                tripOptions.filter(
                  (item) => item.status.toUpperCase() === "READY",
                ).length
              }
            </strong>
            <span>Cleared for departure</span>
          </article>
          <article className="kpi-card">
            <small>In progress on this page</small>
            <strong>
              {
                tripOptions.filter((item) =>
                  ["DEPARTED", "IN_TRANSIT", "DELAYED"].includes(
                    item.status.toUpperCase(),
                  ),
                ).length
              }
            </strong>
            <span>Departed or moving</span>
          </article>
        </div>
        {canPlanRoute && (
          <section className="panel dispatch-calendar-panel">
            <div className="panel-title">
              <div>
                <h2>Monthly dispatch calendar</h2>
                <p>
                  Select a UTC departure date to see unassigned approved orders
                  and build trips.
                </p>
              </div>
              <div className="header-actions">
                <button
                  className="ghost small"
                  onClick={() => {
                    setDispatchMonth(
                      new Date(
                        dispatchMonth.getFullYear(),
                        dispatchMonth.getMonth() - 1,
                        1,
                      ),
                    );
                    setDispatchDate("");
                    setTripPagination((p) => ({ ...p, page: 0 }));
                  }}
                >
                  Previous month
                </button>
                <b>
                  {dispatchMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </b>
                <button
                  className="ghost small"
                  onClick={() => {
                    setDispatchMonth(
                      new Date(
                        dispatchMonth.getFullYear(),
                        dispatchMonth.getMonth() + 1,
                        1,
                      ),
                    );
                    setDispatchDate("");
                    setTripPagination((p) => ({ ...p, page: 0 }));
                  }}
                >
                  Next month
                </button>
              </div>
            </div>
            <div className="dispatch-calendar-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <b className="dispatch-calendar-weekday" key={day}>
                  {day}
                </b>
              ))}
              {dispatchCalendarCells.map((date) => {
                const key = dispatchDateKey(date);
                const day = dispatchDayMap.get(key);
                const inMonth = date.getMonth() === dispatchMonth.getMonth();
                return (
                  <button
                    type="button"
                    key={key}
                    className={`dispatch-calendar-day${inMonth ? "" : " outside"}${dispatchDate === key ? " selected" : ""}${day ? " has-orders" : ""}`}
                    onClick={() => {
                      setDispatchDate(key);
                      setDispatchMonth(
                        new Date(date.getFullYear(), date.getMonth(), 1),
                      );
                      setTripPagination((p) => ({ ...p, page: 0 }));
                    }}
                  >
                    <span>{date.getDate()}</span>
                    {day && (
                      <small>
                        {day.unassignedOrderCount} unassigned · {day.tripCount}{" "}
                        trip{day.tripCount === 1 ? "" : "s"}
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="trip-browser">
              <label>
                Search trip
                <input
                  value={calendarQuery}
                  onChange={(event) => setCalendarQuery(event.target.value)}
                  placeholder="Customer, horse, order no., trip no., or ID"
                />
              </label>
              <label>
                Status
                <select
                  value={tripStatus}
                  onChange={(event) => {
                    setTripStatus(event.target.value);
                    setTripPagination((p) => ({ ...p, page: 0 }));
                  }}
                >
                  <option value="">All statuses</option>
                  {[
                    "PLANNED",
                    "READY",
                    "DEPARTED",
                    "IN_TRANSIT",
                    "DELAYED",
                    "ARRIVED",
                    "HANDED_OVER",
                    "COMPLETED",
                    "CANCELLED",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sort by
                <select
                  value={tripSort}
                  onChange={(event) => {
                    setTripSort(event.target.value);
                    setTripPagination((p) => ({ ...p, page: 0 }));
                  }}
                >
                  <option value="departure">Departure</option>
                  <option value="tripNo">Trip number</option>
                  <option value="status">Status</option>
                  <option value="createdAt">Date created</option>
                </select>
              </label>
              <label>
                Direction
                <select
                  value={tripSortDirection}
                  onChange={(event) => {
                    setTripSortDirection(event.target.value as "asc" | "desc");
                    setTripPagination((p) => ({ ...p, page: 0 }));
                  }}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
            </div>
            {calendarSearchMessage && (
              <p className="field-help" role="status">
                {calendarSearchMessage}
              </p>
            )}
            {dispatchDate && (
              <section className="dispatch-day-orders">
                <div className="panel-title">
                  <div>
                    <h3>
                      Orders for{" "}
                      {new Date(
                        `${dispatchDate}T00:00:00`,
                      ).toLocaleDateString()}
                    </h3>
                    <p>
                      Showing orders not yet assigned to a trip for this UTC
                      departure date.
                    </p>
                  </div>
                  <button
                    disabled={dispatchLoading}
                    className="ghost small"
                    onClick={() =>
                      void getDispatchOrders(dispatchDate)
                        .then(setDispatchOrders)
                        .catch((e) => report(errorText(e)))
                    }
                  >
                    Refresh day
                  </button>
                </div>
                {dispatchLoading ? (
                  <p>Loading orders…</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Select</th>
                          <th>Order</th>
                          <th>Route</th>
                          <th>Mode</th>
                          <th>Horses</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dispatchOrders.map((order) => {
                          const isPaid = (order.paymentStatus ?? "PAID").toUpperCase() === "PAID";
                          const origin = routeLocations.find(
                            (location) =>
                              location.id ===
                              String(order.originLocationId ?? ""),
                          );
                          const destination = routeLocations.find(
                            (location) =>
                              location.id ===
                              String(order.destinationLocationId ?? ""),
                          );
                          return (
                            <tr key={order.orderId}>
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={`Select order ${order.orderId}`}
                                  checked={selectedOrderIds.includes(
                                    order.orderId,
                                  )}
                                  disabled={!isPaid}
                                  onChange={(event) =>
                                    setSelectedOrderIds((current) =>
                                      event.target.checked
                                        ? [...current, order.orderId]
                                        : current.filter(
                                            (id) => id !== order.orderId,
                                          ),
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <b>{order.orderNo ?? "Order pending"}</b>
                                {" - "}
                                <small>
                                  {order.customerName ??
                                    "Customer details pending"}
                                </small>
                                {" - "}
                                <small>
                                  {order.horseIds
                                    .map(
                                      (horseId) =>
                                        order.horseNames?.[horseId] ??
                                        `Horse ${horseId.slice(0, 8)}`,
                                    )
                                    .join(", ")}
                                </small>
                                {!isPaid && (
                                  <>
                                    {" - "}
                                    <small className="blocker">Waiting for customer payment</small>
                                  </>
                                )}
                                {" - "}
                                <small className="mono">{order.orderId}</small>
                              </td>
                              <td>
                                {origin?.name ?? "Pickup location unavailable"}{" "}
                                →{" "}
                                {destination?.name ??
                                  "Delivery location unavailable"}
                              </td>
                              <td>{order.preferredTransportMode ?? "—"}</td>
                              <td>{order.horseIds.length}</td>
                            </tr>
                          );
                        })}
                        {!dispatchOrders.length && (
                          <tr>
                            <td colSpan={5}>
                              No unassigned orders on this day.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="header-actions">
                  <small className="field-help">
                    Orders must share pickup, destination, mode and handover
                    contact.
                  </small>
                  <button
                    disabled={busy || selectedOrderIds.length === 0 || selectedOrderIds.some((id) => (dispatchOrders.find((order) => order.orderId === id)?.paymentStatus ?? "PAID").toUpperCase() !== "PAID")}
                    onClick={() => void createSelectedDispatchTrip()}
                  >
                    {busy
                      ? "Creating trip…"
                      : `Create trip from ${selectedOrderIds.length} order${selectedOrderIds.length === 1 ? "" : "s"}`}
                  </button>
                </div>
                <h3>Trips for selected date</h3>
                <div className="table-wrap">
                  <table className="trip-dashboard-table">
                    <thead>
                      <tr>
                        <th>Trip</th>
                        <th>Route</th>
                        <th>Status</th>
                        <th>Departure</th>
                        <th>Compliance</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTrips.map((item) => {
                        const origin = routeLocations.find(
                          (location) =>
                            location.id === String(item.originLocationId ?? ""),
                        );
                        const destination = routeLocations.find(
                          (location) =>
                            location.id ===
                            String(item.destinationLocationId ?? ""),
                        );
                        return (
                          <tr key={item.id}>
                            <td>
                              <b>
                                {item.customerNames?.join(", ") || item.tripNo}
                              </b>
                              <small>
                                {item.horseNames?.join(", ") ||
                                  `${item.orderCount ?? 1} horse(s)`}
                              </small>
                              <small>
                                {item.tripNo} · {item.orderCount ?? 1} order
                                {(item.orderCount ?? 1) === 1 ? "" : "s"}
                              </small>
                              <small className="mono" title={item.id}>
                                Record ID · {item.id}
                              </small>
                            </td>
                            <td>
                              {origin
                                ? locationLabel(origin)
                                : "Pickup not set"}
                              <span className="trip-route-arrow">→</span>
                              {destination
                                ? locationLabel(destination)
                                : "Delivery not set"}
                            </td>
                            <td>
                              <StatusBadge value={item.status} />
                            </td>
                            <td>
                              {item.plannedDepartureAt
                                ? new Date(
                                    item.plannedDepartureAt,
                                  ).toLocaleString()
                                : "Not scheduled"}
                            </td>
                            <td>
                              <span
                                className={`trip-compliance-state ${item.complianceReady ? "is-ready" : "is-pending"}`}
                              >
                                {item.complianceReady ? "Ready" : "Pending"}
                              </span>
                            </td>
                            <td>
                              <button
                                className="ghost small"
                                onClick={() => setSelectedId(item.id)}
                              >
                                Manage trip
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!visibleTrips.length && (
                        <tr>
                          <td colSpan={6}>
                            {tripListLoading
                              ? "Loading trips…"
                              : "No trips match these filters."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  value={tripPagination}
                  onChange={(page, pageSize) =>
                    setTripPagination((p) => ({ ...p, page, pageSize }))
                  }
                />
              </section>
            )}
          </section>
        )}

        {!canPlanRoute && (
          <>
            <div className="trip-browser">
              <label>
                Search trip
                <input
                  value={tripSearch}
                  onChange={(event) => {
                    setTripSearch(event.target.value);
                    setTripPagination((p) => ({ ...p, page: 0 }));
                  }}
                  placeholder="Customer, horse, order no., trip no., or ID"
                />
              </label>
              <label>
                Status
                <select
                  value={tripStatus}
                  onChange={(event) => {
                    setTripStatus(event.target.value);
                    setTripPagination((p) => ({ ...p, page: 0 }));
                  }}
                >
                  <option value="">All statuses</option>
                  {[
                    "PLANNED",
                    "READY",
                    "DEPARTED",
                    "IN_TRANSIT",
                    "DELAYED",
                    "ARRIVED",
                    "HANDED_OVER",
                    "COMPLETED",
                    "CANCELLED",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sort by
                <select
                  value={tripSort}
                  onChange={(event) => {
                    setTripSort(event.target.value);
                    setTripPagination((p) => ({ ...p, page: 0 }));
                  }}
                >
                  <option value="departure">Departure</option>
                  <option value="tripNo">Trip number</option>
                  <option value="status">Status</option>
                  <option value="createdAt">Date created</option>
                </select>
              </label>
              <label>
                Direction
                <select
                  value={tripSortDirection}
                  onChange={(event) => {
                    setTripSortDirection(event.target.value as "asc" | "desc");
                    setTripPagination((p) => ({ ...p, page: 0 }));
                  }}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
            </div>
            <div className="table-wrap">
              <table className="trip-dashboard-table">
                <thead>
                  <tr>
                    <th>Trip</th>
                    <th>Route</th>
                    <th>Status</th>
                    <th>Departure</th>
                    <th>Compliance</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTrips.map((item) => {
                    const origin = routeLocations.find(
                      (location) =>
                        location.id === String(item.originLocationId ?? ""),
                    );
                    const destination = routeLocations.find(
                      (location) =>
                        location.id ===
                        String(item.destinationLocationId ?? ""),
                    );
                    return (
                      <tr key={item.id}>
                        <td>
                          <b>{item.customerNames?.join(", ") || item.tripNo}</b>
                          <small>
                            {item.horseNames?.join(", ") ||
                              `${item.orderCount ?? 1} horse(s)`}
                          </small>
                          <small>
                            {item.tripNo} · {item.orderCount ?? 1} order
                            {(item.orderCount ?? 1) === 1 ? "" : "s"}
                          </small>
                          <small className="mono" title={item.id}>
                            Record ID · {item.id}
                          </small>
                        </td>
                        <td>
                          {origin ? locationLabel(origin) : "Pickup not set"}
                          <span className="trip-route-arrow">→</span>
                          {destination
                            ? locationLabel(destination)
                            : "Delivery not set"}
                        </td>
                        <td>
                          <StatusBadge value={item.status} />
                        </td>
                        <td>
                          {item.plannedDepartureAt
                            ? new Date(item.plannedDepartureAt).toLocaleString()
                            : "Not scheduled"}
                        </td>
                        <td>
                          <span
                            className={`trip-compliance-state ${item.complianceReady ? "is-ready" : "is-pending"}`}
                          >
                            {item.complianceReady ? "Ready" : "Pending"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="ghost small"
                            onClick={() => setSelectedId(item.id)}
                          >
                            Manage trip
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!visibleTrips.length && (
                    <tr>
                      <td colSpan={6}>
                        {tripListLoading
                          ? "Loading trips…"
                          : "No trips match these filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              value={tripPagination}
              onChange={(page, pageSize) =>
                setTripPagination((p) => ({ ...p, page, pageSize }))
              }
            />
          </>
        )}
      </section>
      {selectedId && trip && (
        <ActionModal
          title="Manage trip"
          description={`Trip ${trip.tripNo} · review the route plan, assignments and readiness.`}
          onClose={() => {
            setSelectedId("");
            setTripForm(null);
            setClearanceLeg(null);
          }}
          className="trip-management-modal"
        >
          <section className="panel" id="trip-management">
            <div className="panel-title">
              <div>
                <h2>Plan trip {trip.tripNo}</h2>
                <p>
                  {canPlanRoute
                    ? "The pickup and delivery come from the approved request. Add checkpoints only when needed."
                    : "Review the route prepared by Logistics, then approve or reject the submitted version."}
                </p>
              </div>
              <div className="header-actions">
                <a className="ghost small" href="#trip-readiness">
                  View readiness
                </a>
                {!plan ? (
                  canPlanRoute ? (
                    <button
                      id="trip-create-plan"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const p = await createPlan(selectedId);
                          setPlan(p);
                          const v = await getVersions(p.id);
                          const activeVersion = v.at(-1) ?? null;
                          setVersions(v);
                          setVersion(activeVersion);
                          const initialLegs = activeVersion
                            ? await getLegs(activeVersion.id)
                            : [];
                          setLegs(initialLegs);
                          setCheckpoints(
                            initialLegs[0]
                              ? await getCheckpoints(initialLegs[0].id)
                              : [],
                          );
                        }, "Route plan created from the request pickup and delivery.")
                      }
                    >
                      1. Create route plan
                    </button>
                  ) : (
                    <p className="field-help">
                      Waiting for Logistics to prepare the route for Manager
                      review.
                    </p>
                  )
                ) : (
                  <>
                    {canPlanRoute && (
                      <button
                        className="ghost"
                        onClick={() => setTripForm("new-version")}
                      >
                        New version
                      </button>
                    )}
                    {canPlanRoute && tripForm === "new-version" && (
                      <ActionModal
                        title="Create route version"
                        description="Start a draft to revise the trip’s itinerary."
                        onClose={() => setTripForm(null)}
                      >
                        <form
                          className="form-grid"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void run(async () => {
                              const v = await newVersion(plan.id, reason);
                              setReason("");
                              setVersion(v);
                              setVersions(await getVersions(plan.id));
                              const copiedLegs = await getLegs(v.id);
                              setLegs(copiedLegs);
                              setCheckpoints(
                                copiedLegs[0]
                                  ? await getCheckpoints(copiedLegs[0].id)
                                  : [],
                              );
                              setTripForm(null);
                            }, "New draft version created.");
                          }}
                        >
                          <label className="span-2">
                            Reason for change
                            <input
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              required
                            />
                          </label>
                          <div className="modal-actions span-2">
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => setTripForm(null)}
                            >
                              Cancel
                            </button>
                            <button disabled={busy}>Create version</button>
                          </div>
                        </form>
                      </ActionModal>
                    )}
                  </>
                )}
              </div>
            </div>
            {canPlanRoute ? (
              <ol className="field-help" aria-label="Logistics steps">
                <li>
                  Build the route and assign the vehicle or flight, horses,
                  driver and escort while the route is a draft.
                </li>
                <li>Submit the complete dispatch plan for Manager approval.</li>
                <li>
                  After approval activates the route, resolve any remaining
                  readiness blockers and confirm READY.
                </li>
              </ol>
            ) : (
              <p className="field-help">
                Manager: review the route, crew and resources submitted by
                Logistics. Approve and activate the complete dispatch plan so
                Logistics can resolve final readiness blockers.
              </p>
            )}
            <section className="notice-card">
              <b>
                Orders on this trip ·{" "}
                {tripOrders.length || trip.orderCount || 1}
              </b>
              {tripOrders.length ? (
                <ul>
                  {tripOrders.map((order) => (
                    <li key={order.orderId}>
                      <b>{order.customerName ?? "Customer details pending"}</b>{" "}
                      ·{" "}
                      {order.horseIds
                        .map(
                          (horseId) =>
                            order.horseNames?.[horseId] ??
                            `Horse ${horseId.slice(0, 8)}`,
                        )
                        .join(", ")}
                      <small className="mono">
                        {order.orderNo ?? order.orderId} · {order.orderId}
                      </small>
                      {order.receiverName
                        ? ` · Receiver: ${order.receiverName}`
                        : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Order details are not available for this trip.</p>
              )}
            </section>
            {canReviewRoute &&
              version?.status.toUpperCase() === "PENDING_APPROVAL" && (
                <section className="notice-card">
                  <b>Proposed dispatch plan</b>
                  <p>
                    Review the assigned crew and equipment with the route before
                    approval.
                  </p>
                  <ul>
                    {assignments.staff
                      .filter(
                        (item) =>
                          !item.releasedAt &&
                          legs.some(
                            (leg) => String(leg.id) === String(item.routeLegId),
                          ),
                      )
                      .map((item) => {
                        const member = staffDirectory.find(
                          (staff) => staff.id === String(item.userId),
                        );
                        return (
                          <li key={item.id}>
                            {member?.fullName ?? item.role} · {item.role}
                            <small className="mono">{item.userId}</small>
                          </li>
                        );
                      })}
                    {assignments.resources
                      .filter((item) =>
                        legs.some(
                          (leg) => String(leg.id) === String(item.routeLegId),
                        ),
                      )
                      .map((item) => (
                        <li key={item.id}>
                          {item.vehicleId
                            ? resourceLabel(
                                fleetVehicles.find(
                                  (resource) =>
                                    String(resource.id) ===
                                    String(item.vehicleId),
                                ) ?? { id: String(item.vehicleId) },
                              )
                            : resourceLabel(
                                flightBookings.find(
                                  (resource) =>
                                    String(resource.id) ===
                                    String(item.flightBookingId ?? ""),
                                ) ?? { id: String(item.flightBookingId ?? "") },
                              )}
                        </li>
                      ))}
                    {assignments.horses
                      .filter((item) =>
                        legs.some(
                          (leg) => String(leg.id) === String(item.routeLegId),
                        ),
                      )
                      .map((item) => {
                        const horse = requestHorseOptions.find(
                          (option) => option.id === String(item.horseId),
                        );
                        const stall = fleetStalls.find(
                          (option) =>
                            String(option.id) === String(item.stallId),
                        );
                        return (
                          <li key={`horse-${item.id}`}>
                            {horse?.label ??
                              `Horse ${String(item.horseId).slice(0, 8)}`}{" "}
                            · {stall?.stallCode ?? "Compartment missing"}
                          </li>
                        );
                      })}
                    {!assignments.staff.some(
                      (item) =>
                        !item.releasedAt &&
                        legs.some(
                          (leg) => String(leg.id) === String(item.routeLegId),
                        ),
                    ) && <li>No crew assigned yet.</li>}
                  </ul>
                </section>
              )}
            {plan && (
              <>
                <div className="version-bar">
                  <span>Route plan v{plan.versionNo}</span>
                  <select
                    value={version?.id ?? ""}
                    onChange={(e) => void selectVersion(e.target.value)}
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        Version {v.versionNo} · {v.status}
                      </option>
                    ))}
                  </select>
                  <div className="header-actions">
                    {canPlanRoute &&
                      version &&
                      ["DRAFT", "REJECTED"].includes(
                        version.status.toUpperCase(),
                      ) && (
                        <button
                          className="ghost"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                action(
                                  `/api/v1/route-plan-versions/${version.id}/submit`,
                                ),
                              "Version submitted for approval.",
                            )
                          }
                        >
                          Submit
                        </button>
                      )}
                    {canReviewRoute &&
                      version &&
                      version.status.toUpperCase() === "PENDING_APPROVAL" && (
                        <button
                          className="ghost"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                action(
                                  `/api/v1/route-plan-versions/${version.id}/approve`,
                                ),
                              "Version approved.",
                            )
                          }
                        >
                          Approve
                        </button>
                      )}
                    {canReviewRoute &&
                      version &&
                      version.status.toUpperCase() === "APPROVED" && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                action(
                                  `/api/v1/route-plan-versions/${version.id}/activate`,
                                ),
                              "Version activated.",
                            )
                          }
                        >
                          Activate
                        </button>
                      )}
                  </div>
                </div>
                <section className="notice-card" id="trip-route">
                  <b>Pickup-to-delivery route</b>
                  {legs[0] ? (
                    <>
                      <p>
                        {locationLabel(
                          routeLocations.find(
                            (item) =>
                              item.id === String(legs[0].originLocationId),
                          ) ?? {
                            id: String(legs[0].originLocationId),
                            name: String(legs[0].originLocationId),
                          },
                        )}{" "}
                        →{" "}
                        {locationLabel(
                          routeLocations.find(
                            (item) =>
                              item.id === String(legs[0].destinationLocationId),
                          ) ?? {
                            id: String(legs[0].destinationLocationId),
                            name: String(legs[0].destinationLocationId),
                          },
                        )}{" "}
                        · {legs[0].transportMode}
                      </p>
                      {canPlanRoute &&
                        version?.status.toUpperCase() === "DRAFT" && (
                          <>
                            <div className="route-template-controls">
                              <label>
                                Saved route template
                                <select
                                  value={routeTemplateId}
                                  onChange={(event) => {
                                    const id = event.target.value;
                                    if (!id) {
                                      setRouteTemplateId("");
                                      return;
                                    }
                                    const template = routeTemplates.find(
                                      (item) => item.id === id,
                                    );
                                    if (!template) return;
                                    if (
                                      routeEditing &&
                                      JSON.stringify(draftRouteShape) !==
                                        JSON.stringify(savedRouteShape) &&
                                      !window.confirm(
                                        "Replace your unsaved route edits with this template?",
                                      )
                                    )
                                      return;
                                    setRouteTemplateId(id);
                                    setDraftRouteShape(
                                      template.points.map((point) => ({
                                        ...point,
                                      })),
                                    );
                                    setRouteEditing(true);
                                  }}
                                >
                                  <option value="">
                                    {routeTemplates.length
                                      ? "Choose a matching template"
                                      : "No matching templates yet"}
                                  </option>
                                  {routeTemplates.map((template) => (
                                    <option
                                      key={template.id}
                                      value={template.id}
                                    >
                                      {template.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => setRouteTemplateSaveOpen(true)}
                              >
                                Save as template
                              </button>
                              <small className="field-help">
                                A template fills the editable map. Save route to
                                apply it to this draft; operational checkpoints
                                are managed separately.
                              </small>
                            </div>
                            {routeTemplateSaveOpen && (
                              <ActionModal
                                title="Save route template"
                                description="Save these map points for another trip with the same route and transport mode."
                                onClose={() => setRouteTemplateSaveOpen(false)}
                              >
                                <form
                                  className="form-grid"
                                  onSubmit={(event) =>
                                    void saveCurrentRouteTemplate(event)
                                  }
                                >
                                  <label className="span-2">
                                    Template name
                                    <input
                                      name="name"
                                      required
                                      maxLength={120}
                                      autoFocus
                                    />
                                  </label>
                                  <p className="field-help span-2">
                                    This saves the currently displayed map
                                    points. Operational checkpoints are not
                                    copied.
                                  </p>
                                  <div className="modal-actions">
                                    <button
                                      type="button"
                                      className="ghost"
                                      onClick={() =>
                                        setRouteTemplateSaveOpen(false)
                                      }
                                    >
                                      Cancel
                                    </button>
                                    <button disabled={busy}>
                                      {busy ? "Saving…" : "Save template"}
                                    </button>
                                  </div>
                                </form>
                              </ActionModal>
                            )}
                          </>
                        )}
                      <OsmRouteMap
                        waypoints={routeMapWaypoints}
                        mode={String(legs[0].transportMode ?? "ROAD")}
                        shapePoints={
                          routeEditing ? draftRouteShape : savedRouteShape
                        }
                        editable={routeEditing}
                        onShapeChange={setDraftRouteShape}
                      />
                      {canPlanRoute &&
                        version?.status.toUpperCase() === "DRAFT" && (
                          <div className="header-actions">
                            {routeEditing ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void saveEditedRoute()}
                                >
                                  {busy ? "Saving…" : "Save route"}
                                </button>
                                <button
                                  type="button"
                                  className="ghost"
                                  disabled={busy}
                                  onClick={() => {
                                    setRouteEditing(false);
                                    setDraftRouteShape([]);
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="ghost"
                                  disabled={busy || !draftRouteShape.length}
                                  onClick={() => setDraftRouteShape([])}
                                >
                                  Clear route points
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => {
                                  setDraftRouteShape(
                                    savedRouteShape.map((point) => ({
                                      ...point,
                                    })),
                                  );
                                  setRouteEditing(true);
                                }}
                              >
                                Edit route on map
                              </button>
                            )}
                          </div>
                        )}
                      <p>
                        {(() => {
                          const countryId = borderCountryForLeg(legs[0]);
                          const linkedCase = tripClearanceCases.find(
                            (item) => item.routeLegId === legs[0].id,
                          );
                          return countryId ? (
                            linkedCase ? (
                              <>
                                Border clearance: <b>{linkedCase.caseNo}</b> ·{" "}
                                {linkedCase.status.replaceAll("_", " ")}
                              </>
                            ) : (
                              <>
                                This route crosses a country border.{" "}
                                <button
                                  className="ghost small"
                                  onClick={() => setClearanceLeg(legs[0])}
                                >
                                  Create border clearance case
                                </button>
                              </>
                            )
                          ) : (
                            "Domestic route · no border clearance case required."
                          );
                        })()}
                      </p>
                    </>
                  ) : (
                    <p>
                      The request route is not available yet. Refresh trips
                      after Planning receives the approved request details.
                    </p>
                  )}
                </section>
                {clearanceLeg && (
                  <ActionModal
                    title="Create border clearance case"
                    description="This route leg crosses a country border. Trip, route leg and destination country are filled in for you. This creates an internal draft, not a submission to a border authority."
                    onClose={() => setClearanceLeg(null)}
                  >
                    <form className="form-grid" onSubmit={saveBorderCase}>
                      <div className="detail-field">
                        <small>Trip</small>
                        <b>{trip?.tripNo ?? selectedId}</b>
                      </div>
                      <div className="detail-field">
                        <small>Route leg</small>
                        <b>
                          Leg {clearanceLeg.sequenceNo}:{" "}
                          {locationLabel(
                            routeLocations.find(
                              (item) =>
                                item.id ===
                                String(clearanceLeg.originLocationId),
                            ) ?? {
                              id: String(clearanceLeg.originLocationId),
                              name: String(clearanceLeg.originLocationId),
                            },
                          )}{" "}
                          →{" "}
                          {locationLabel(
                            routeLocations.find(
                              (item) =>
                                item.id ===
                                String(clearanceLeg.destinationLocationId),
                            ) ?? {
                              id: String(clearanceLeg.destinationLocationId),
                              name: String(clearanceLeg.destinationLocationId),
                            },
                          )}
                        </b>
                      </div>
                      <div className="detail-field">
                        <small>Destination country</small>
                        <b>
                          {routeCountries.find(
                            (item) =>
                              item.id === borderCountryForLeg(clearanceLeg),
                          )?.name ?? "Country from destination location"}
                        </b>
                      </div>
                      <input
                        type="hidden"
                        name="countryId"
                        value={borderCountryForLeg(clearanceLeg)}
                      />
                      <label>
                        Clearance type
                        <select name="clearanceType" defaultValue="CUSTOMS" required>
                          <option value="CUSTOMS">Customs</option>
                          <option value="QUARANTINE">Quarantine</option>
                          <option value="INSPECTION">Inspection</option>
                        </select>
                      </label>
                      <label className="span-2">
                        Border authority
                        <input
                          name="authorityName"
                          placeholder="e.g. Customs authority"
                          required
                        />
                      </label>
                      <label>
                        Reference number
                        <input name="referenceNumber" />
                      </label>
                      <label className="span-2">
                        Notes
                        <input
                          name="notes"
                          placeholder="Optional details for the compliance team"
                        />
                      </label>
                      <div className="modal-actions span-2">
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setClearanceLeg(null)}
                        >
                          Cancel
                        </button>
                        <button
                          disabled={busy || !borderCountryForLeg(clearanceLeg)}
                        >
                          {busy ? "Creating…" : "Create linked case"}
                        </button>
                      </div>
                    </form>
                  </ActionModal>
                )}
                {canPlanRoute && legs.length > 0 && (
                  <div className="planning-tools" id="trip-resources">
                    <section>
                      <h3>Route checkpoints</h3>
                      <p>
                        Add a saved location to make the OSM route pass through
                        it.
                      </p>
                      {checkpoints.map((cp) => (
                        <div className="assignment-row" key={cp.id}>
                          <span>
                            #{cp.sequenceNo} · {cp.type}
                          </span>
                          <span>
                            {routeLocations.find(
                              (item) => item.id === cp.locationId,
                            )
                              ? locationLabel(
                                  routeLocations.find(
                                    (item) => item.id === cp.locationId,
                                  )!,
                                )
                              : cp.locationId}
                          </span>
                        </div>
                      ))}
                      {version?.status.toUpperCase() === "DRAFT" && (
                        <>
                          <button
                            className="ghost small"
                            onClick={() => setTripForm("checkpoint")}
                          >
                            Add checkpoint
                          </button>
                          {tripForm === "checkpoint" && (
                            <ActionModal
                              title="Add route checkpoint"
                              description="Choose a saved location; the route map will recalculate through this stop."
                              onClose={() => setTripForm(null)}
                            >
                              <form
                                className="form-grid"
                                onSubmit={onAddCheckpoint}
                              >
                                <label>
                                  Checkpoint location
                                  <select
                                    name="locationId"
                                    required
                                    defaultValue=""
                                  >
                                    <option value="">Choose a location</option>
                                    {routeLocations
                                      .filter((item) => item.active !== false)
                                      .map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {locationLabel(item)}
                                        </option>
                                      ))}
                                  </select>
                                </label>
                                <label>
                                  Checkpoint type
                                  <select name="type" defaultValue="CHECKPOINT">
                                    <option value="CHECKPOINT">
                                      Checkpoint
                                    </option>
                                    <option value="REST_STOP">Rest stop</option>
                                    <option value="FUEL_STOP">Fuel stop</option>
                                    <option value="BORDER_CROSSING">
                                      Border crossing
                                    </option>
                                    <option value="QUARANTINE_STATION">
                                      Quarantine
                                    </option>
                                  </select>
                                </label>
                                <div className="modal-actions span-2">
                                  <button
                                    type="button"
                                    className="ghost"
                                    onClick={() => setTripForm(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button disabled={busy}>
                                    Add checkpoint
                                  </button>
                                </div>
                              </form>
                            </ActionModal>
                          )}
                        </>
                      )}
                    </section>
                    {canAssignRoute && assignmentLeg ? (
                      <>
                        <section className="assignment-leg-card">
                          <h3>Route leg for assignments</h3>
                          <label className="assignment-leg-picker">
                            <span className="field-help">
                              Choose the leg to plan
                            </span>
                            <select
                              value={String(assignmentLeg.id)}
                              onChange={(event) =>
                                setAssignmentLegId(event.target.value)
                              }
                            >
                              {legs.map((leg) => (
                                <option key={leg.id} value={String(leg.id)}>
                                  Leg {leg.sequenceNo} ·{" "}
                                  {locationLabel(
                                    routeLocations.find(
                                      (item) =>
                                        item.id ===
                                        String(leg.originLocationId),
                                    ) ?? {
                                      id: String(leg.originLocationId),
                                      name: String(leg.originLocationId),
                                    },
                                  )}{" "}
                                  →{" "}
                                  {locationLabel(
                                    routeLocations.find(
                                      (item) =>
                                        item.id ===
                                        String(leg.destinationLocationId),
                                    ) ?? {
                                      id: String(leg.destinationLocationId),
                                      name: String(leg.destinationLocationId),
                                    },
                                  )}{" "}
                                  · {leg.transportMode}
                                </option>
                              ))}
                            </select>
                          </label>
                        </section>
                        <section className="leg-schedule-card">
                          <h3>Leg schedule</h3>
                          <div className="leg-schedule-times">
                            <div>
                              <small>Departure</small>
                              <b>
                                {assignmentLeg.plannedDepartureAt
                                  ? utcDate(
                                      assignmentLeg.plannedDepartureAt,
                                    ).toLocaleString()
                                  : "Not set"}
                              </b>
                            </div>
                            <div>
                              <small>Arrival</small>
                              <b>
                                {assignmentLeg.plannedArrivalAt
                                  ? utcDate(
                                      assignmentLeg.plannedArrivalAt,
                                    ).toLocaleString()
                                  : "Not set"}
                              </b>
                            </div>
                          </div>
                          {version?.status.toUpperCase() === "DRAFT" && (
                            <div>
                              <button
                                type="button"
                                className="ghost small"
                                onClick={() => setTripForm("schedule")}
                              >
                                {assignmentLeg.plannedDepartureAt &&
                                assignmentLeg.plannedArrivalAt
                                  ? "Edit schedule"
                                  : "Set leg schedule"}
                              </button>
                              {(!assignmentLeg.plannedDepartureAt ||
                                !assignmentLeg.plannedArrivalAt) && (
                                <p className="field-help">
                                  Set departure and arrival times before
                                  assigning staff.
                                </p>
                              )}
                            </div>
                          )}
                          {tripForm === "schedule" && (
                            <ActionModal
                              title="Set leg schedule"
                              description="Enter the planned departure and arrival for this leg so staff availability can be checked."
                              onClose={() => setTripForm(null)}
                            >
                              <form
                                className="form-grid"
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  const f = new FormData(e.currentTarget);
                                  const departure = new Date(
                                    String(f.get("departureAt")),
                                  );
                                  const arrival = new Date(
                                    String(f.get("arrivalAt")),
                                  );
                                  if (
                                    !Number.isFinite(departure.getTime()) ||
                                    !Number.isFinite(arrival.getTime()) ||
                                    arrival <= departure
                                  ) {
                                    report("Arrival must be after departure.");
                                    return;
                                  }
                                  const succeeded = await run(
                                    () =>
                                      updateLeg(String(assignmentLeg.id), {
                                        sequenceNo: Number(
                                          assignmentLeg.sequenceNo,
                                        ),
                                        originLocationId:
                                          assignmentLeg.originLocationId,
                                        destinationLocationId:
                                          assignmentLeg.destinationLocationId,
                                        mode: assignmentLeg.transportMode,
                                        departureAt: departure.toISOString(),
                                        arrivalAt: arrival.toISOString(),
                                        distanceKm:
                                          assignmentLeg.distanceKm == null
                                            ? null
                                            : Number(assignmentLeg.distanceKm),
                                      }),
                                    "Leg schedule updated.",
                                  );
                                  if (succeeded) setTripForm(null);
                                }}
                              >
                                <label>
                                  Departure
                                  <input
                                    type="datetime-local"
                                    name="departureAt"
                                    defaultValue={
                                      assignmentLeg.plannedDepartureAt
                                        ? legLocalDateTime(
                                            assignmentLeg.plannedDepartureAt,
                                          )
                                        : ""
                                    }
                                    required
                                  />
                                </label>
                                <label>
                                  Arrival
                                  <input
                                    type="datetime-local"
                                    name="arrivalAt"
                                    defaultValue={
                                      assignmentLeg.plannedArrivalAt
                                        ? legLocalDateTime(
                                            assignmentLeg.plannedArrivalAt,
                                          )
                                        : ""
                                    }
                                    required
                                  />
                                </label>
                                <div className="modal-actions">
                                  <button
                                    type="button"
                                    className="ghost"
                                    onClick={() => setTripForm(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button disabled={busy}>Save schedule</button>
                                </div>
                              </form>
                            </ActionModal>
                          )}
                        </section>
                        <section>
                          <h3>Resource assignment</h3>
                          <p>
                            Assign a vehicle or flight booking to leg{" "}
                            {assignmentLeg.sequenceNo}.
                          </p>
                          {assignments.resources
                            .filter(
                              (a) =>
                                String(a.routeLegId) ===
                                String(assignmentLeg.id),
                            )
                            .map((a) => (
                              <div className="assignment-row" key={a.id}>
                                <span>
                                  {a.vehicleId ? "Vehicle" : "Flight"}
                                </span>
                                <span>
                                  {a.vehicleId
                                    ? resourceLabel(
                                        fleetVehicles.find(
                                          (item) =>
                                            item.id === String(a.vehicleId),
                                        ) ?? { id: String(a.vehicleId) },
                                      )
                                    : resourceLabel(
                                        flightBookings.find(
                                          (item) =>
                                            item.id ===
                                            String(a.flightBookingId ?? ""),
                                        ) ?? {
                                          id: String(a.flightBookingId ?? ""),
                                        },
                                      )}
                                </span>
                              </div>
                            ))}
                          <button
                            className="ghost small"
                            onClick={() => setTripForm("resource")}
                          >
                            Assign resource
                          </button>
                          {tripForm === "resource" && (
                            <ActionModal
                              title="Assign vehicle or flight"
                              description={`Assign a resource to route leg ${assignmentLeg.sequenceNo}.`}
                              onClose={() => setTripForm(null)}
                            >
                              <form
                                className="form-grid"
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  const form = e.currentTarget;
                                  const f = new FormData(form);
                                  const succeeded = await run(
                                    () =>
                                      assignResource(assignmentLeg.id, {
                                        vehicleId:
                                          String(f.get("vehicleId") || "") ||
                                          null,
                                        flightBookingId:
                                          String(
                                            f.get("flightBookingId") || "",
                                          ) || null,
                                      }),
                                    "Resource assigned.",
                                  );
                                  if (succeeded) {
                                    form.reset();
                                    setTripForm(null);
                                  }
                                }}
                              >
                                {String(
                                  assignmentLeg.transportMode,
                                ).toUpperCase() === "ROAD" ? (
                                  <label className="span-2">
                                    Vehicle
                                    <select
                                      name="vehicleId"
                                      defaultValue=""
                                      required
                                    >
                                      <option value="">
                                        Choose an available vehicle
                                      </option>
                                      {fleetVehicles
                                        .filter(
                                          (item) =>
                                            String(
                                              item.status,
                                            ).toUpperCase() === "AVAILABLE",
                                        )
                                        .map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {resourceLabel(item)}
                                          </option>
                                        ))}
                                    </select>
                                  </label>
                                ) : String(
                                    assignmentLeg.transportMode,
                                  ).toUpperCase() === "AIR" ? (
                                  <label className="span-2">
                                    Confirmed flight booking
                                    <select
                                      name="flightBookingId"
                                      defaultValue=""
                                      required
                                    >
                                      <option value="">
                                        Choose a confirmed flight for this route
                                      </option>
                                      {availableLegFlights.map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {resourceLabel(item)} ·{" "}
                                          {utcDate(
                                            item.scheduledDepartureAt,
                                          ).toLocaleString()}
                                        </option>
                                      ))}
                                    </select>
                                    {!availableLegFlights.length && (
                                      <small className="field-help">
                                        No confirmed flight matches these
                                        airports and the planned schedule. Ask
                                        authorized staff to confirm a matching
                                        flight option first.
                                      </small>
                                    )}
                                  </label>
                                ) : (
                                  <p className="field-help span-2">
                                    Choose a supported transport mode before
                                    assigning a resource.
                                  </p>
                                )}
                                <div className="modal-actions span-2">
                                  <button
                                    type="button"
                                    className="ghost"
                                    onClick={() => setTripForm(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button disabled={busy}>
                                    Assign resource
                                  </button>
                                </div>
                              </form>
                            </ActionModal>
                          )}
                        </section>
                        <section>
                          <h3>Staff assignment</h3>
                          {assignments.staff
                            .filter(
                              (a) =>
                                String(a.routeLegId) ===
                                  String(assignmentLeg.id) && !a.releasedAt,
                            )
                            .map((a) => {
                              const member = staffDirectory.find(
                                (item) => item.id === String(a.userId),
                              );
                              return (
                                <div className="assignment-row" key={a.id}>
                                  <span>
                                    {member
                                      ? `${member.fullName} · ${a.role}`
                                      : a.role}
                                    <small>{member?.email ?? a.userId}</small>
                                  </span>
                                </div>
                              );
                            })}
                          <button
                            className="ghost small"
                            onClick={() => {
                              setStaffRole(
                                String(
                                  assignmentLeg.transportMode,
                                ).toUpperCase() === "AIR"
                                  ? "ESCORT"
                                  : "DRIVER",
                              );
                              setStaffUserId("");
                              setTripForm("staff");
                            }}
                          >
                            Assign staff
                          </button>
                          {tripForm === "staff" && (
                            <ActionModal
                              title="Assign trip staff"
                              description="Driver and escort assignments are checked for schedule conflicts; drivers also need approved country coverage."
                              onClose={() => setTripForm(null)}
                            >
                              <form
                                className="form-grid"
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  const f = new FormData(e.currentTarget);
                                  const succeeded = await run(
                                    () =>
                                      assignStaff(selectedId, {
                                        legId: assignmentLeg.id,
                                        userId: f.get("userId"),
                                        role: f.get("role"),
                                      }),
                                    "Staff member assigned.",
                                  );
                                  if (succeeded) setTripForm(null);
                                  setStaffUserId("");
                                }}
                              >
                                <label>
                                  Staff member
                                  <select
                                    name="userId"
                                    value={staffUserId}
                                    onChange={(event) =>
                                      setStaffUserId(event.target.value)
                                    }
                                    required
                                  >
                                    <option value="">
                                      Choose an active staff member
                                    </option>
                                    {staffDirectory
                                      .filter(
                                        (member) =>
                                          member.role === staffRole ||
                                          member.role === "DRIVER_ESCORT",
                                      )
                                      .map((member) => (
                                        <option
                                          key={member.id}
                                          value={member.id}
                                        >
                                          {member.fullName} · {member.role} ·{" "}
                                          {member.email}
                                        </option>
                                      ))}
                                  </select>
                                  <small className="field-help">
                                    Only active driver and escort accounts are
                                    listed.
                                  </small>
                                </label>
                                <label>
                                  Assignment role
                                  <select
                                    name="role"
                                    value={staffRole}
                                    onChange={(event) => {
                                      setStaffRole(
                                        event.target.value as
                                          | "DRIVER"
                                          | "ESCORT",
                                      );
                                      setStaffUserId("");
                                    }}
                                  >
                                    <option value="DRIVER">Driver</option>
                                    <option value="ESCORT">Escort</option>
                                  </select>
                                  <small className="field-help">
                                    A driver must be approved for every country
                                    on this leg through its planned arrival.
                                  </small>
                                </label>
                                {role === "ADMIN" &&
                                  staffRole === "DRIVER" &&
                                  staffUserId && (
                                    <button
                                      type="button"
                                      className="ghost small"
                                      onClick={() => setStaffCoverageOpen(true)}
                                    >
                                      Set approved countries
                                    </button>
                                  )}
                                {role === "ADMIN" &&
                                  staffRole === "DRIVER" &&
                                  staffUserId && (
                                    <button
                                      type="button"
                                      className="ghost small"
                                      onClick={() => setStaffAreasOpen(true)}
                                    >
                                      Set operating areas
                                    </button>
                                  )}
                                {staffRole === "DRIVER" &&
                                  String(
                                    assignmentLeg.transportMode ?? "",
                                  ).toUpperCase() === "ROAD" && (
                                    <button
                                      type="button"
                                      className="ghost small span-2"
                                      disabled={busy}
                                      onClick={() =>
                                        void autoAssignNearestDriver()
                                      }
                                    >
                                      Auto-assign nearest available driver
                                    </button>
                                  )}
                                <div className="modal-actions span-2">
                                  <button
                                    type="button"
                                    className="ghost"
                                    onClick={() => setTripForm(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    disabled={busy || !staffDirectory.length}
                                  >
                                    Assign staff
                                  </button>
                                </div>
                              </form>
                            </ActionModal>
                          )}
                          {staffCoverageOpen &&
                            staffDirectory.find(
                              (member) => member.id === staffUserId,
                            ) && (
                              <StaffRouteCountriesModal
                                user={
                                  staffDirectory.find(
                                    (member) => member.id === staffUserId,
                                  )!
                                }
                                countries={routeCountries}
                                report={report}
                                notify={notify}
                                onClose={() => setStaffCoverageOpen(false)}
                                onSaved={() => {
                                  void loadTrip();
                                }}
                              />
                            )}
                          {staffAreasOpen &&
                            staffDirectory.find(
                              (member) => member.id === staffUserId,
                            ) && (
                              <StaffOperatingAreasModal
                                user={
                                  staffDirectory.find(
                                    (member) => member.id === staffUserId,
                                  )!
                                }
                                locations={routeLocations}
                                countries={routeCountries}
                                report={report}
                                notify={notify}
                                onClose={() => setStaffAreasOpen(false)}
                                onSaved={() => {
                                  void loadTrip();
                                }}
                              />
                            )}
                        </section>
                        <section className="horse-assignment-card">
                          <div className="assignment-card-heading">
                            <div>
                              <h3>Horse & compartment assignment</h3>
                              <p>
                                View each horse and its transport compartment
                                together.
                              </p>
                            </div>
                            <span className="assignment-count">
                              {legHorseAssignments.length} assigned
                            </span>
                          </div>
                          {legHorseAssignments.length ? (
                            <div className="horse-assignment-list">
                              {legHorseAssignments.map((a) => {
                                const compartment = fleetStalls.find(
                                  (item) =>
                                    String(item.id) === String(a.stallId),
                                );
                                const horse = requestHorseOptions.find(
                                  (item) => item.id === String(a.horseId),
                                );
                                return (
                                  <article
                                    className="horse-assignment-item"
                                    key={a.id}
                                  >
                                    <div className="horse-assignment-identity">
                                      <span
                                        className="horse-assignment-icon"
                                        aria-hidden="true"
                                      >
                                        H
                                      </span>
                                      <div>
                                        <b>
                                          {horse?.label &&
                                          horse.label !== a.horseId
                                            ? horse.label
                                            : `Horse ${String(a.horseId).slice(0, 8)}`}
                                        </b>
                                        <small
                                          className="mono"
                                          title={String(a.horseId)}
                                        >
                                          {a.horseId}
                                        </small>
                                      </div>
                                    </div>
                                    <div className="horse-compartment-detail">
                                      <small>Compartment</small>
                                      {compartment ? (
                                        <>
                                          <b>
                                            {String(
                                              compartment.stallCode ??
                                                "Compartment",
                                            )}
                                          </b>
                                          <span>
                                            {String(
                                              compartment.stallType ??
                                                "Type not specified",
                                            )}{" "}
                                            · Capacity{" "}
                                            {String(
                                              compartment.capacity ?? "—",
                                            )}{" "}
                                            horses
                                          </span>
                                        </>
                                      ) : (
                                        <b className="compartment-unassigned">
                                          {a.stallId
                                            ? `Compartment ${String(a.stallId).slice(0, 8)} (details unavailable)`
                                            : "Not assigned"}
                                        </b>
                                      )}
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="assignment-empty">
                              No horses assigned yet. Assign a requested horse
                              and choose its compartment.
                            </div>
                          )}
                          <button
                            className="ghost small"
                            onClick={() => setTripForm("horse")}
                          >
                            Assign horse & compartment
                          </button>
                          {tripForm === "horse" && (
                            <ActionModal
                              title="Assign horse to trip"
                              description="Assign a horse from the approved request to this trip."
                              onClose={() => setTripForm(null)}
                            >
                              <form
                                className="form-grid"
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  const form = e.currentTarget;
                                  const f = new FormData(form);
                                  const succeeded = await run(
                                    () =>
                                      assignHorse(selectedId, {
                                        horseId: f.get("horseId"),
                                        legId: assignmentLeg.id,
                                        stallId:
                                          String(f.get("stallId") || "") ||
                                          null,
                                      }),
                                    "Horse assigned.",
                                  );
                                  if (succeeded) {
                                    form.reset();
                                    setTripForm(null);
                                  }
                                }}
                              >
                                <label>
                                  Horse{" "}
                                  {requestHorseOptions.length ? (
                                    <select
                                      name="horseId"
                                      required
                                      defaultValue=""
                                    >
                                      <option value="">
                                        Choose a horse from the approved request
                                      </option>
                                      {requestHorseOptions
                                        .filter(
                                          (horse) =>
                                            !assignments.horses.some(
                                              (assigned) =>
                                                String(assigned.routeLegId) ===
                                                  String(assignmentLeg.id) &&
                                                String(assigned.horseId) ===
                                                  horse.id,
                                            ),
                                        )
                                        .map((horse) => (
                                          <option
                                            key={horse.id}
                                            value={horse.id}
                                          >
                                            {horse.label}
                                          </option>
                                        ))}
                                    </select>
                                  ) : (
                                    <input
                                      name="horseId"
                                      placeholder="Horse ID from the approved request"
                                      required
                                    />
                                  )}
                                  <small className="field-help">
                                    {requestHorseOptions.length
                                      ? "These named horses were selected by the owner for this request."
                                      : "For older trips, use the horse ID recorded on the approved request."}
                                  </small>
                                </label>
                                <label>
                                  Horse compartment
                                  <select
                                    name="stallId"
                                    defaultValue=""
                                    required
                                  >
                                    <option value="">
                                      Choose a compartment
                                    </option>
                                    {fleetStalls
                                      .filter((item) => item.active !== false)
                                      .map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {item.stallCode}
                                          {item.stallType
                                            ? ` · ${item.stallType}`
                                            : ""}{" "}
                                          · capacity ${item.capacity}
                                        </option>
                                      ))}
                                  </select>
                                </label>
                                <div className="modal-actions span-2">
                                  <button
                                    type="button"
                                    className="ghost"
                                    onClick={() => setTripForm(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    disabled={
                                      busy ||
                                      (requestHorseOptions.length > 0 &&
                                        requestHorseOptions.every((horse) =>
                                          assignments.horses.some(
                                            (assigned) =>
                                              String(assigned.routeLegId) ===
                                                String(assignmentLeg.id) &&
                                              String(assigned.horseId) ===
                                                horse.id,
                                          ),
                                        ))
                                    }
                                  >
                                    Assign horse
                                  </button>
                                </div>
                              </form>
                            </ActionModal>
                          )}
                        </section>
                      </>
                    ) : (
                      <p className="field-help">
                        Prepare assignments while the route is a draft, then
                        submit the complete dispatch plan for Manager approval.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="readiness" id="trip-readiness">
              <div>
                <h3>Pre-departure readiness</h3>
                <p>
                  {readiness
                    ? readiness.ready
                      ? "No blockers reported."
                      : `${readiness.blockers.length} blocker(s) need attention.`
                    : "Loading readiness…"}
                </p>
                {readiness?.blockers.map((b, i) => (
                  <p className="blocker" key={i}>
                    • {b}{" "}
                    <a href={`#${readinessTarget(b)}`}>
                      Open related planning step
                    </a>
                  </p>
                ))}
                {readiness && !readiness.ready && (
                  <p className="field-help">
                    Use the steps above to resolve route, resource, staff,
                    horse, or compliance blockers. Refresh the trip after
                    correcting a blocker to recalculate readiness.
                  </p>
                )}
                {trip?.status.toUpperCase() === "READY" && (
                  <p className="field-help">
                    Trip is READY. The assigned Driver can start departure from
                    Execution.
                  </p>
                )}
              </div>
              {canPlanRoute &&
                readiness?.ready &&
                trip?.status.toUpperCase() !== "READY" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          action(`/api/v1/trips/${selectedId}/confirm-ready`),
                        "Trip confirmed ready.",
                      )
                    }
                  >
                    Confirm READY
                  </button>
                )}
            </div>
          </section>
        </ActionModal>
      )}
    </div>
  );
}

function FleetView({
  resourceKey,
  role,
  report,
  notify,
}: {
  resourceKey?: ResourceName;
  role: string;
  report: (s: string) => void;
  notify: (s: string) => void;
}) {
  const [resource, setResource] = useState<FleetResource>(
    () => fleet.find((item) => item.key === resourceKey) ?? fleet[0],
  );
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [countries, setCountries] = useState<RecordRow[]>([]);
  const [airlines, setAirlines] = useState<RecordRow[]>([]);
  const [locations, setLocations] = useState<RecordRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [tableQuery, setTableQuery] = useState("");
  const [tableSort, setTableSort] = useState("");
  const [tableSortDirection, setTableSortDirection] = useState<"asc" | "desc">(
    "asc",
  );
  const load = useCallback(async () => {
    try {
      setRows(await getRows(resource.key));
    } catch (e) {
      report(errorText(e));
    }
  }, [resource, report]);
  useEffect(() => {
    if (resourceKey)
      setResource(fleet.find((item) => item.key === resourceKey) ?? fleet[0]);
  }, [resourceKey]);
  useEffect(() => {
    setEditing(null);
    setValues({});
    void load();
  }, [load]);
  useEffect(() => {
    Promise.all([
      getRows("countries"),
      getRows("airlines"),
      getRows("locations"),
    ])
      .then(([countryRows, airlineRows, locationRows]) => {
        setCountries(countryRows);
        setAirlines(airlineRows);
        setLocations(locationRows);
      })
      .catch((error) => report(errorText(error)));
  }, [report]);

  function fieldValue(field: FleetField, value: RecordRow[string] | undefined) {
    if (value == null) return field.defaultValue ?? "";
    if (field.kind === "datetime")
      return new Date(String(value)).toISOString().slice(0, 16);
    return String(value);
  }
  function edit(row?: RecordRow) {
    setEditing(row ?? null);
    setValues(
      Object.fromEntries(
        resource.fields.map((field) => [
          field.key,
          row ? fieldValue(field, row[field.key]) : (field.defaultValue ?? ""),
        ]),
      ),
    );
  }
  function cancelEdit() {
    setEditing(null);
    setValues({});
  }
  function sourceRows(field: FleetField) {
    if (field.source === "countries")
      return countries.filter((row) => row.active !== false);
    if (field.source === "airlines")
      return airlines.filter((row) => row.active !== false);
    if (field.source === "airports")
      return locations.filter(
        (row) =>
          row.active !== false &&
          String(row.locationType).toUpperCase() === "AIRPORT",
      );
    return [];
  }
  function optionLabel(field: FleetField, row: RecordRow) {
    if (field.source === "countries") return `${row.name} · ${row.isoCode}`;
    if (field.source === "airlines") return `${row.name} · ${row.airlineCode}`;
    return `${row.name}${row.city ? ` · ${row.city}` : ""}${row.locationCode ? ` · ${row.locationCode}` : ""}`;
  }
  function displayCell(key: string, value: RecordRow[string]) {
    if (value == null) return "—";
    if (key === "countryId") {
      const row = countries.find((item) => item.id === String(value));
      return row ? `${row.name} (${row.isoCode})` : value;
    }
    if (key === "airlineId") {
      const row = airlines.find((item) => item.id === String(value));
      return row ? `${row.name} (${row.airlineCode})` : value;
    }
    if (key === "originAirportId" || key === "destinationAirportId") {
      const row = locations.find((item) => item.id === String(value));
      return row ? `${row.name}${row.city ? ` · ${row.city}` : ""}` : value;
    }
    if (key.endsWith("At")) return new Date(String(value)).toLocaleString();
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return value;
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const input: Record<string, unknown> = {};
    for (const field of resource.fields) {
      if (field.kind === "generated" && !editing) continue;
      const value = values[field.key] ?? "";
      if (field.kind === "boolean") input[field.key] = value === "true";
      else if (field.kind === "number")
        input[field.key] = value === "" ? null : Number(value);
      else if (field.kind === "datetime")
        input[field.key] = value ? new Date(value).toISOString() : null;
      else if (["isoCode", "airlineCode"].includes(field.key))
        input[field.key] = value.trim().toUpperCase();
      else input[field.key] = value.trim() || null;
    }
    try {
      if (
        resource.key === "countries" &&
        role === "LOGISTICS_MANAGER" &&
        editing
      )
        await setCountrySupport(editing.id, Boolean(input.active));
      else await saveRow(resource.key, editing?.id, input);
      notify(
        resource.key === "countries"
          ? editing
            ? role === "LOGISTICS_MANAGER"
              ? "Country support updated."
              : "Country details updated."
            : "Supported country added."
          : `${resource.title} record saved.`,
      );
      cancelEdit();
      await load();
    } catch (e) {
      report(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: RecordRow) {
    if (
      !window.confirm(
        `Delete ${row.name ?? row.vehicleCode ?? row.stallCode ?? row.id}?`,
      )
    )
      return;
    try {
      await deleteRow(resource.key, row.id);
      notify("Record deleted.");
      await load();
    } catch (e) {
      report(errorText(e));
    }
  }
  async function changeFlightBookingStatus(
    row: RecordRow,
    next: "confirm" | "cancel",
  ) {
    if (
      next === "cancel" &&
      !window.confirm(
        `Cancel flight booking ${row.bookingReference ?? row.id}?`,
      )
    )
      return;
    setBusy(true);
    try {
      if (next === "confirm") await confirmFlightBooking(row.id);
      else await cancelFlightBooking(row.id);
      notify(
        next === "confirm"
          ? "Flight booking confirmed."
          : "Flight booking cancelled.",
      );
      await load();
    } catch (error) {
      report(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  const airportLocations = locations.filter(
    (row) =>
      row.active !== false &&
      String(row.locationType).toUpperCase() === "AIRPORT",
  );
  const singularTitle =
    resource.title === "Countries"
      ? "Country"
      : resource.title === "Horse compartments"
        ? "compartment"
        : resource.title.replace(/s$/, "");
  const referenceCatalog =
    resource.key === "countries" || resource.key === "airlines";
  const canMaintainCatalog = role === "ADMIN";
  const canEditRecord =
    !referenceCatalog ||
    canMaintainCatalog ||
    (resource.key === "countries" && role === "LOGISTICS_MANAGER");
  const canShowActions = canEditRecord || resource.key === "flight-bookings";
  const canConfirmFlightBookings = [
    "ADMIN",
    "LOGISTICS_MANAGER",
    "FLEET_ROUTE_COORDINATOR",
  ].includes(role);
  const countrySupportOnly =
    resource.key === "countries" &&
    role === "LOGISTICS_MANAGER" &&
    editing !== null;
  const visibleRows = useMemo(() => {
    const query = tableQuery.trim().toLocaleLowerCase();
    const filtered = rows.filter(
      (row) =>
        !query ||
        Object.values(row)
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
    );
    if (!tableSort) return filtered;
    return filtered.sort((a, b) => {
      const comparison = String(a[tableSort] ?? "").localeCompare(
        String(b[tableSort] ?? ""),
        undefined,
        { numeric: true, sensitivity: "base" },
      );
      return tableSortDirection === "asc" ? comparison : -comparison;
    });
  }, [rows, tableQuery, tableSort, tableSortDirection]);
  const selectedMapPoint: MapPoint | null =
    values.latitude && values.longitude
      ? {
          latitude: Number(values.latitude),
          longitude: Number(values.longitude),
        }
      : null;
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>{resource.title}</h2>
            <p>{resource.description}</p>
          </div>
          {resource.key !== "flight-bookings" &&
            (!referenceCatalog || canMaintainCatalog) && (
              <button onClick={() => edit()}>
                {resource.key === "countries"
                  ? "+ Add supported country"
                  : `+ Add ${singularTitle}`}
              </button>
            )}
        </div>
        {resource.key === "flight-bookings" && (
          <p className="notice-card">
            <b>Internal schedule inventory</b> · These options are for workflow
            practice. They are not live airline availability or a confirmed
            cargo reservation. Confirm with the carrier through your normal
            booking process before assigning a real trip.
          </p>
        )}
        <div className="table-tools">
          <label>
            Search {resource.title.toLowerCase()}
            <input
              value={tableQuery}
              onChange={(event) => setTableQuery(event.target.value)}
              placeholder="Search visible records…"
            />
          </label>
          <label>
            Sort by
            <select
              value={tableSort}
              onChange={(event) => setTableSort(event.target.value)}
            >
              <option value="">Default order</option>
              {resource.columns.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Direction
            <select
              value={tableSortDirection}
              onChange={(event) =>
                setTableSortDirection(event.target.value as "asc" | "desc")
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <small className="field-help">
            {visibleRows.length} of {rows.length} records
          </small>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {resource.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                {canShowActions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  {resource.columns.map((column) => (
                    <td key={column.key}>
                      {column.key === "bookingReference" &&
                      String(row.bookingReference).startsWith("DEMO-") ? (
                        <>
                          {row[column.key]}
                          <small className="subtle">
                            Synthetic demo option
                          </small>
                        </>
                      ) : (
                        displayCell(column.key, row[column.key])
                      )}
                    </td>
                  ))}
                  {canShowActions && (
                    <td>
                      {resource.key !== "flight-bookings" && (
                        <>
                          <button
                            className="ghost small"
                            onClick={() => edit(row)}
                          >
                            {resource.key === "countries"
                              ? canMaintainCatalog
                                ? "Edit"
                                : "Change support"
                              : "Edit"}
                          </button>
                          {resource.key !== "countries" &&
                            (!referenceCatalog || canMaintainCatalog) && (
                              <>
                                {" "}
                                <button
                                  className="danger small"
                                  onClick={() => void remove(row)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                        </>
                      )}
                      {resource.key === "flight-bookings" &&
                        canConfirmFlightBookings &&
                        String(row.confirmationStatus).toUpperCase() ===
                          "PENDING" && (
                          <button
                            className="ghost small"
                            disabled={busy}
                            onClick={() =>
                              void changeFlightBookingStatus(row, "confirm")
                            }
                          >
                            Mark carrier booking confirmed
                          </button>
                        )}
                      {resource.key === "flight-bookings" &&
                        canConfirmFlightBookings &&
                        ["PENDING", "CONFIRMED"].includes(
                          String(row.confirmationStatus).toUpperCase(),
                        ) && (
                          <button
                            className="danger small"
                            disabled={busy}
                            onClick={() =>
                              void changeFlightBookingStatus(row, "cancel")
                            }
                          >
                            Cancel reservation
                          </button>
                        )}
                    </td>
                  )}
                </tr>
              ))}
              {!visibleRows.length && (
                <tr>
                  <td
                    colSpan={resource.columns.length + (canShowActions ? 1 : 0)}
                  >
                    {rows.length
                      ? "No records match this search."
                      : `No ${resource.title.toLowerCase()} are available. Demo schedule options require demo data to be enabled.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {resource.key !== "flight-bookings" &&
      (editing !== null || Object.keys(values).length > 0) ? (
        <ActionModal
          title={
            resource.key === "countries"
              ? editing
                ? countrySupportOnly
                  ? "Change country support"
                  : "Edit country"
                : "Add supported country"
              : `${editing ? "Edit" : "Add"} ${singularTitle}`
          }
          description={
            resource.key === "countries"
              ? editing
                ? countrySupportOnly
                  ? "Choose whether this country is supported for locations and transport routes."
                  : "Update the country code, name, or support status."
                : "Add a country to the supported country list."
              : resource.description
          }
          onClose={cancelEdit}
        >
          <form className="form-grid" onSubmit={save}>
            {resource.fields
              .filter(
                (field) =>
                  field.kind !== "generated" &&
                  (!countrySupportOnly || field.key === "active"),
              )
              .map((field) => {
                const value = values[field.key] ?? "";
                const update = (next: string) =>
                  setValues((current) => ({ ...current, [field.key]: next }));
                const help = field.help ? (
                  <small className="field-help">{field.help}</small>
                ) : null;
                if (field.kind === "boolean")
                  return (
                    <label key={field.key} className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={value === "true"}
                        onChange={(event) =>
                          update(String(event.target.checked))
                        }
                      />
                      {field.label}
                    </label>
                  );
                if (field.kind === "select") {
                  const options =
                    field.options ??
                    sourceRows(field).map((row) => ({
                      value: row.id,
                      label: optionLabel(field, row),
                    }));
                  return (
                    <label key={field.key}>
                      {field.label}
                      <select
                        value={value}
                        required={field.required}
                        onChange={(event) => update(event.target.value)}
                      >
                        <option value="">
                          {field.source === "airports" &&
                          !airportLocations.length
                            ? "Add an airport location first"
                            : field.source === "airlines" && !airlines.length
                              ? "Add an airline first"
                              : field.source === "countries" &&
                                  !countries.length
                                ? "Add a supported country first"
                                : "Choose an option"}
                        </option>
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {help}
                    </label>
                  );
                }
                if (field.kind === "textarea")
                  return (
                    <label key={field.key} className="span-2">
                      {field.label}
                      <textarea
                        value={value}
                        onChange={(event) => update(event.target.value)}
                        rows={3}
                        required={field.required}
                      />
                      {help}
                    </label>
                  );
                return (
                  <label key={field.key}>
                    {field.label}
                    <input
                      value={value}
                      readOnly={field.kind === "generated"}
                      placeholder={
                        field.kind === "generated" && !editing
                          ? "Assigned when saved"
                          : undefined
                      }
                      type={
                        field.kind === "number"
                          ? "number"
                          : field.kind === "datetime"
                            ? "datetime-local"
                            : "text"
                      }
                      min={field.min}
                      max={field.max}
                      maxLength={field.maxLength}
                      step={
                        field.kind === "number"
                          ? (field.step ?? "any")
                          : undefined
                      }
                      required={field.required}
                      onChange={(event) => update(event.target.value)}
                    />
                    {help}
                  </label>
                );
              })}
            {resource.key === "locations" && (
              <div className="span-2">
                <OsmPointPicker
                  label="Search and pin this location on OpenStreetMap"
                  selected={selectedMapPoint}
                  onSelect={(point, place) =>
                    setValues((current) => ({
                      ...current,
                      latitude: point ? String(point.latitude) : "",
                      longitude: point ? String(point.longitude) : "",
                      ...(place
                        ? {
                            name: place.name,
                            address: place.address,
                            city: place.city,
                            ...(place.countryCode
                              ? {
                                  countryId: String(
                                    countries.find(
                                      (country) =>
                                        country.active !== false &&
                                        String(
                                          country.isoCode,
                                        ).toUpperCase() === place.countryCode,
                                    )?.id ?? "",
                                  ),
                                }
                              : {}),
                          }
                        : {}),
                    }))
                  }
                />
                <small className="field-help">
                  Selecting a search result or map point fills available place
                  details. Check the name, address, city, and country before
                  saving; you can edit every field.
                </small>
              </div>
            )}
            <div className="modal-actions span-2">
              <button type="button" className="ghost" onClick={cancelEdit}>
                Cancel
              </button>
              <button disabled={busy}>
                {busy
                  ? "Saving…"
                  : resource.key === "countries" && !editing
                    ? "Add supported country"
                    : resource.key === "countries" && editing
                      ? "Save changes"
                      : "Save record"}
              </button>
            </div>
          </form>
        </ActionModal>
      ) : null}
    </div>
  );
}
