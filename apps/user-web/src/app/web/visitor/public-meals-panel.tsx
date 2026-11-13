"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PublicMealsClient,
  type PublicMealProjection,
  type PublicMealType,
} from "../../../local-synthetic/public-meals";

const mealLabels: Record<PublicMealType, string> = {
  BREAKFAST: "早餐",
  LUNCH: "午餐",
  SNACK: "加餐",
  DINNER: "晚餐",
};

function todayInShanghai(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const field = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${field("year")}-${field("month")}-${field("day")}`;
}

type MealState = {
  readonly status: "LOADING" | "READY" | "ERROR";
  readonly date: string;
  readonly meals: readonly PublicMealProjection[];
};

export function PublicMealsPanel() {
  const [state, setState] = useState<MealState>({ status: "LOADING", date: "", meals: [] });
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const date = todayInShanghai();
    setState({ status: "LOADING", date, meals: [] });
    try {
      const meals = await new PublicMealsClient({ baseUrl: window.location.origin }).forDate(date);
      if (current === generation.current) setState({ status: "READY", date, meals });
    } catch {
      if (current === generation.current) setState({ status: "ERROR", date, meals: [] });
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh]);

  return (
    <section aria-label="当日食谱" data-public-meals-state={state.status}>
      <div className="visitor-section-heading">
        <p className="section-note">
          <time dateTime={state.date || undefined} data-public-meals-date={state.date}>
            {state.date || "正在确认日期"}
          </time>
          {" · 当日食谱"}
        </p>
        <button
          type="button"
          className="button button-secondary"
          disabled={state.status === "LOADING"}
          onClick={() => void refresh()}
        >
          刷新食谱
        </button>
      </div>
      {state.status === "ERROR" ? (
        <p role="alert">暂时无法读取食谱，请稍后重试。</p>
      ) : (
        <p role="status" aria-live="polite">
          {state.status === "LOADING"
            ? "正在读取当日食谱…"
            : state.meals.length === 0
              ? "本日暂无已发布餐食。"
              : "已更新当日食谱。"}
        </p>
      )}
      {state.status === "READY" &&
        state.meals.map((meal) => (
          <article className="public-vertical-card visitor-meal-card" key={meal.id}>
            <h2>{mealLabels[meal.meal_type]}</h2>
            <ul>
              {meal.items.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ul>
            {meal.notes && <p>{meal.notes}</p>}
          </article>
        ))}
      <p className="section-note">模拟数据 · 仅显示已发布餐食。</p>
    </section>
  );
}
