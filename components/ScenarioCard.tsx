import React from "react";
import { Scenario } from "../types";
interface ScenarioCardProps {
  scenario: Scenario;
  depth?: number;
  onSelect: () => void;
  locked?: boolean;
  freeChoice?: boolean;
  choosingFree?: boolean;
}
export const ScenarioCard: React.FC<ScenarioCardProps> = ({
  scenario,
  onSelect,
  locked = false,
  freeChoice = false,
  choosingFree = false,
}) => (
  <button
    type="button"
    disabled={locked}
    onClick={onSelect}
    className={`group relative w-full text-left border rounded-3xl p-8 flex flex-col h-full shadow-sm transition-colors ${locked ? "bg-gray-50 border-gray-200 cursor-not-allowed" : freeChoice ? "border-indigo-400 bg-indigo-50 hover:border-indigo-600" : "bg-white border-gray-200 hover:border-indigo-400"}`}
  >
    {(freeChoice || locked || choosingFree) && (
      <span
        className={`text-xs font-semibold rounded-full px-3 py-1 mb-5 self-start ${freeChoice ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"}`}
      >
        {freeChoice
          ? "Your free scenario"
          : locked
            ? "Full access required"
            : "Available as your free scenario"}
      </span>
    )}
    <h3 className="text-2xl font-bold text-gray-900 mb-4 tracking-tight">
      {scenario.title}
    </h3>
    <p className="text-gray-600 text-sm leading-relaxed mb-8 whitespace-pre-wrap line-clamp-6">
      {scenario.description}
    </p>
    <span className="mt-auto pt-5 border-t border-gray-200 w-full font-semibold text-sm">
      {locked
        ? "Your free account includes your chosen scenario"
        : freeChoice
          ? "Open your scenario"
          : choosingFree
            ? "Choose this scenario"
            : "Enter Lab"}
    </span>
  </button>
);
