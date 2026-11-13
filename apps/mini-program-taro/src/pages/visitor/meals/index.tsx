import Taro from "@tarojs/taro";
import { Button, Picker, Text, View } from "@tarojs/components";
import { useEffect, useState } from "react";
import { loadPublicMeals, type PublicMeal } from "../../../public/visitor-meals";
import "./index.css";

type MealPageStatus = "loading" | "ready" | "empty" | "error";

const MEAL_LABELS = {
  BREAKFAST: "早餐",
  LUNCH: "午餐",
  SNACK: "加餐",
  DINNER: "晚餐",
} as const;

function localDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function VisitorMeals() {
  const [selectedDate, setSelectedDate] = useState(localDate);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [status, setStatus] = useState<MealPageStatus>("loading");
  const [meals, setMeals] = useState<readonly PublicMeal[]>([]);

  useEffect(() => {
    let active = true;
    setMeals([]);
    setStatus("loading");

    void loadPublicMeals({
      baseUrl: __TARO_API_BASE_URL__,
      publicReference: __TARO_PUBLIC_REFERENCE__,
      date: selectedDate,
      allowLocalHttp: __TARO_ALLOW_LOCAL_HTTP__,
      request: async (url, options) => {
        const response = await Taro.request({ url, ...options });
        return { statusCode: response.statusCode, data: response.data };
      },
    }).then(
      (records) => {
        if (!active) return;
        setMeals(records);
        setStatus(records.length === 0 ? "empty" : "ready");
      },
      () => {
        if (!active) return;
        setMeals([]);
        setStatus("error");
      },
    );

    return () => {
      active = false;
    };
  }, [selectedDate, reloadVersion]);

  return (
    <View className="visitor-meals-page">
      <Button
        className="visitor-meals-return"
        onClick={() => void Taro.redirectTo({ url: "/pages/visitor/home/index" })}
      >
        ‹ 返回访客首页
      </Button>

      <View className="visitor-meals-heading">
        <Text className="visitor-meals-eyebrow">同芯学园 · 访客公开信息</Text>
        <Text className="visitor-meals-title">餐食安排</Text>
        <Text className="visitor-meals-intro">
          查看所选日期已发布的餐单。未发布的内容不会显示。
        </Text>
      </View>

      <Picker
        mode="date"
        value={selectedDate}
        onChange={(event) => setSelectedDate(String(event.detail.value))}
      >
        <View className="visitor-meals-date-picker">
          <Text className="visitor-meals-date-label">查看日期</Text>
          <Text className="visitor-meals-date-value">{selectedDate}</Text>
        </View>
      </Picker>

      {status === "loading" ? (
        <View className="visitor-meals-state">
          <Text>正在读取餐食安排…</Text>
        </View>
      ) : null}

      {status === "empty" ? (
        <View className="visitor-meals-state">
          <Text className="visitor-meals-state-title">暂无已发布餐单</Text>
          <Text>请更换日期查看。</Text>
        </View>
      ) : null}

      {status === "error" ? (
        <View className="visitor-meals-state">
          <Text className="visitor-meals-state-title">暂时无法读取餐食安排</Text>
          <Text>请稍后重试。</Text>
          <Button
            className="visitor-meals-retry"
            onClick={() => setReloadVersion((version) => version + 1)}
          >
            重新加载
          </Button>
        </View>
      ) : null}

      {status === "ready" ? (
        <View className="visitor-meals-list">
          {meals.map((meal) => (
            <View className="visitor-meal-card" key={meal.id}>
              <Text className="visitor-meal-type">{MEAL_LABELS[meal.mealType]}</Text>
              <View className="visitor-meal-items">
                {meal.items.map((item, index) => (
                  <Text className="visitor-meal-item" key={`${index}-${item}`}>
                    {item}
                  </Text>
                ))}
              </View>
              {meal.notes ? <Text className="visitor-meal-notes">{meal.notes}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
