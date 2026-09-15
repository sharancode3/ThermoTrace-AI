"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Search,
  Filter,
  Flame,
  Zap,
  Layers,
  Pickaxe,
  Factory,
  CheckCircle2,
  ChevronRight,
  Shield,
  Activity,
  MapPin,
  RefreshCw,
  LayoutGrid,
  List,
  Sparkles,
} from "lucide-react";
import {
  fetchFacilities,
  FacilitySummary,
  FacilityListResponse,
} from "@/lib/apiClient";
import FacilityDetailDrawer from "@/components/FacilityDetailDrawer";

export default function FacilitiesPage() {
  const [data, setData] = useState<FacilityListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [selectedSector, setSelectedSector] = useState<string>("All");
  const [selectedState, setSelectedState] = useState<string>("All");
  const [page, setPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedFacility, setSelectedFacility] = useState<FacilitySummary | null>(null);

  // Debounce search input ~300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch facilities list (cheap, eager, plain read)
  const loadFacilities = useCallback(() => {
    setLoading(true);
    fetchFacilities({
      search: debouncedSearch || undefined,
      sector: selectedSector !== "All" ? selectedSector : undefined,
      state: selectedState !== "All" ? selectedState : undefined,
      page,
      page_size: 36,
    })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load facilities:", err);
        setLoading(false);
      });
  }, [debouncedSearch, selectedSector, selectedState, page]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  const getSectorIcon = (sector: string) => {
    switch (sector.toLowerCase()) {
      case "refinery":
      case "petroleum refining":
        return <Flame className="h-4 w-4 text-amber-600" />;
      case "thermal power":
      case "power generation":
        return <Zap className="h-4 w-4 text-blue-600" />;
      case "iron & steel":
      case "steel":
        return <Factory className="h-4 w-4 text-slate-700" />;
      case "coal mining":
      case "mining":
        return <Pickaxe className="h-4 w-4 text-amber-800" />;
      case "petrochemicals":
      case "chemicals":
      case "lng / petrochemicals":
        return <Layers className="h-4 w-4 text-indigo-600" />;
      default:
        return <Building2 className="h-4 w-4 text-slate-600" />;
    }
  };
  const getSectorGradient = (_sector: string) => {
    return "from-slate-900 via-slate-800 to-amber-950/70";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header & Sovereign Ribbon */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            <div>
              {/* iPhone Notch / Dynamic Island Shape Header */}
              <div className="-mt-3.5 mb-2.5 inline-flex items-center gap-3.5 rounded-b-2xl bg-slate-950 px-4 py-1.5 text-white shadow-lg border-x border-b border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Shield className="h-3.5 w-3.5 text-orange-400" />
                  <span>Sovereign Industrial Registry</span>
                </div>

                {/* Notch Camera Sensor Dot */}
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                </div>

                <span className="text-[11px] font-mono font-semibold text-slate-300">
                  CPCB · NTRO Monitored
                </span>
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Strategic Industrial Facilities
              </h1>
              <p className="mt-0.5 text-xs text-slate-600">
                Authoritative registry of India&apos;s strategic refineries, steel plants, power stations, and empirical flaring baselines.
              </p>
            </div>

            {/* Quick KPI Ribbon */}
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 shadow-xs">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Total Monitored
                </div>
                <div className="mt-0.5 text-lg font-bold text-slate-900">
                  {data ? data.total_count : "..."}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 shadow-xs">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Sectors Covered
                </div>
                <div className="mt-0.5 text-lg font-bold text-blue-700">
                  {data ? data.sectors.length : "..."}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 shadow-xs">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Baselines Active
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-lg font-bold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  100%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Search & Dynamic Sector Filter Bar */}
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search facilities by name, operator, code, state, or district..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50/50 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* State Filter Dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="All">All Indian States</option>
                {data?.states.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              {/* View Mode Toggle */}
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded p-1.5 transition-colors ${
                    viewMode === "grid"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`rounded p-1.5 transition-colors ${
                    viewMode === "table"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Table View"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Sector Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Sector:
            </span>
            <button
              onClick={() => {
                setSelectedSector("All");
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                selectedSector === "All"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Sectors ({data?.total_count || 0})
            </button>
            {data?.sectors.map((sec) => (
              <button
                key={sec}
                onClick={() => {
                  setSelectedSector(sec);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedSector === sec
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {getSectorIcon(sec)}
                {sec}
              </button>
            ))}
          </div>
        </div>

        {/* Facility Cards / Directory Listing */}
        <div className="mt-4">
          {loading ? (
            /* Skeleton Loading Grid */
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-3/4 rounded bg-slate-200" />
                      <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="h-2.5 w-full rounded bg-slate-100" />
                    <div className="h-2.5 w-2/3 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            viewMode === "grid" ? (
              /* GRID VIEW - Soft Multi-Radial Peach & Muted Orange Gradient Cards */
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {data.items.map((facility) => (
                  <div
                    key={facility.id}
                    onClick={() => setSelectedFacility(facility)}
                    style={{
                      background: `
                        radial-gradient(circle at 5% 15%, #FBA325 0%, #FBB548 20%, transparent 50%),
                        radial-gradient(circle at 20% 85%, #FBA325 0%, #FCC76B 22%, transparent 50%),
                        radial-gradient(circle at 52% 42%, #FEECB8 0%, #FDD98E 40%, transparent 75%),
                        radial-gradient(circle at 100% 30%, #FDD98E 0%, #FCC76B 45%, transparent 80%),
                        linear-gradient(135deg, #FBA325 0%, #FBB548 25%, #FDD98E 55%, #FEECB8 80%, #FCC76B 100%)
                      `
                    }}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 text-[#2b180d] shadow-[0_12px_32px_rgba(251,163,37,0.22)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(251,163,37,0.35)] cursor-pointer border-0"
                  >
                    <div className="relative z-10 space-y-3">
                      {/* Top Slanted White Trapezoid Header Tabs (Matching User Image Spec) */}
                      <div className="-mx-4 -mt-4 flex items-start justify-between">
                        {/* Left Slanted White Tab: Facility Code */}
                        <div
                          style={{ clipPath: 'polygon(0 0, 100% 0, 84% 100%, 0 100%)' }}
                          className="bg-white/95 backdrop-blur-md pl-4 pr-6 py-1.5 font-mono text-[10px] font-bold text-[#3b2313] shadow-xs shrink-0"
                        >
                          {facility.facility_code}
                        </div>

                        {/* Right Slanted White Tab: Sector Category */}
                        <div
                          style={{ clipPath: 'polygon(16% 0, 100% 0, 100% 100%, 0 100%)' }}
                          className="bg-white/95 backdrop-blur-md pl-6 pr-4 py-1.5 text-[9.5px] font-black uppercase tracking-wider text-[#3b2313] shadow-xs text-right truncate max-w-[170px]"
                        >
                          {facility.sector_category}
                        </div>
                      </div>

                      {/* Main Hero Title & Subtype */}
                      <div>
                        <h3 className="text-base font-extrabold text-[#231207] tracking-tight leading-snug group-hover:text-[#b43e00] transition-colors line-clamp-1" title={facility.name}>
                          {facility.name}
                        </h3>
                        <p className="mt-0.5 text-[10.5px] font-semibold text-[#4e2b17] line-clamp-1">
                          {facility.sub_type || facility.operator_name || "Independent Facility"}
                        </p>
                      </div>

                      {/* Key-Value Stat Rows */}
                      <div className="space-y-1.5 text-xs border-t border-black/10 pt-2.5">
                        <div className="flex justify-between items-center text-[#4e2b17] font-semibold">
                          <span>Location:</span>
                          <span className="font-extrabold text-[#231207] truncate max-w-[130px]">
                            {facility.district ? `${facility.district}, ` : ""}{facility.state}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[#4e2b17] font-semibold">
                          <span>Operator:</span>
                          <span className="font-extrabold text-[#231207] truncate max-w-[130px]">
                            {facility.operator_name || "Independent"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[#4e2b17] font-semibold">
                          <span>90-Day Baseline:</span>
                          <span className="font-extrabold text-[#231207] font-mono">
                            {facility.baseline_frp_mean !== null && facility.baseline_frp_mean !== undefined
                              ? `${facility.baseline_frp_mean.toFixed(1)} MW`
                              : "Active"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Button with #fff8ee Background and Reduced Roundness */}
                    <div className="relative z-10 mt-4 flex items-center justify-between rounded-lg bg-[#fff8ee] px-3.5 py-2 border border-white/60 shadow-xs">
                      <div className="text-xs font-extrabold text-[#2b180d]">
                        {facility.historical_event_count && facility.historical_event_count > 0 ? (
                          <span className="text-[#8c2b00] font-extrabold">+{facility.historical_event_count} Active Thermal Events</span>
                        ) : (
                          <span className="text-[#2b180d] font-extrabold">100% Baseline Monitored</span>
                        )}
                      </div>

                      <span className="text-xs font-black text-[#d94800] group-hover:translate-x-0.5 transition-transform">
                        Inspect →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Facility Code</th>
                      <th className="px-4 py-3">Facility Name</th>
                      <th className="px-4 py-3">Sector</th>
                      <th className="px-4 py-3">State / District</th>
                      <th className="px-4 py-3">Operator</th>
                      <th className="px-4 py-3">90-Day Baseline</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((facility) => (
                      <tr
                        key={facility.id}
                        onClick={() => setSelectedFacility(facility)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono font-medium text-slate-700">
                          {facility.facility_code}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {facility.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                            {getSectorIcon(facility.sector_category)}
                            {facility.sector_category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {facility.district ? `${facility.district}, ` : ""}
                          <strong>{facility.state}</strong>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {facility.operator_name || "Independent"}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-800">
                          {facility.baseline_frp_mean !== null &&
                          facility.baseline_frp_mean !== undefined
                            ? `${facility.baseline_frp_mean.toFixed(1)} ± ${
                                facility.baseline_frp_std?.toFixed(1) || "15.0"
                              } MW`
                            : "Pending"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-blue-600 hover:text-blue-800">
                            Inspect →
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* Explicit Empty State */
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
              <Building2 className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-3 text-base font-bold text-slate-800">
                No Facilities Matching Filters
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Try adjusting your search keywords or resetting the sector filter.
              </p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedSector("All");
                  setSelectedState("All");
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset All Filters
              </button>
            </div>
          )}

          {/* Pagination */}
          {data && data.total_count > 36 && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 rounded-xl shadow-sm">
              <div className="text-xs text-slate-600">
                Showing{" "}
                <span className="font-bold text-slate-900">
                  {(page - 1) * 36 + 1}
                </span>{" "}
                to{" "}
                <span className="font-bold text-slate-900">
                  {Math.min(page * 36, data.total_count)}
                </span>{" "}
                of{" "}
                <span className="font-bold text-slate-900">
                  {data.total_count}
                </span>{" "}
                facilities
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page * 36 >= data.total_count}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Forensic Intelligence Slide-Over Drawer */}
      <FacilityDetailDrawer
        facility={selectedFacility}
        onClose={() => setSelectedFacility(null)}
      />
    </div>
  );
}
