import Taro from "@tarojs/taro";
import { useMemo, useState } from "react";
import { Button, Picker, Text, View } from "@tarojs/components";
import {
  filterVisitorActivities,
  VISITOR_ACTIVITIES,
} from "../../../public/visitor-activities";
import "./index.css";

export default function VisitorActivities() {
  const [selectedDate, setSelectedDate] = useState("");
  const activities = useMemo(
    () => filterVisitorActivities(VISITOR_ACTIVITIES, selectedDate),
    [selectedDate],
  );

  return (
    <View className="activities-page">
      <Button
        className="activities-return-button"
        onClick={() =>
          void Taro.redirectTo({ url: "/pages/visitor/home/index" })
        }
      >
        ‹ 返回访客首页
      </Button>

      <View className="activities-heading">
        <Text className="activities-eyebrow">同芯学园 · 访客公开信息</Text>
        <Text className="activities-title">活动分享</Text>
        <Text className="activities-intro">
          看看课后时光里的创作、阅读与小小发现。
        </Text>
      </View>

      <View className="activities-filter-row">
        <Picker
          mode="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(String(event.detail.value))}
        >
          <View className="activities-date-picker">
            <Text className="activities-filter-label">日期筛选</Text>
            <Text className="activities-filter-value">
              {selectedDate || "选择日期"}
            </Text>
          </View>
        </Picker>
        {selectedDate ? (
          <Button
            className="activities-clear-button"
            onClick={() => setSelectedDate("")}
          >
            清除筛选
          </Button>
        ) : null}
      </View>

      <Text className="activities-sample-note">模拟数据 · 活动示例</Text>

      {activities.length > 0 ? (
        <View className="activities-list">
          {activities.map((activity) => (
            <Button
              key={activity.id}
              className="activity-card"
              onClick={() =>
                void Taro.navigateTo({
                  url: `/pages/visitor/activity-detail/index?id=${encodeURIComponent(activity.id)}`,
                })
              }
            >
              <View className="activity-card-topline">
                <Text className="activity-category">{activity.category}</Text>
                <Text className="activity-date">{activity.date}</Text>
              </View>
              <Text className="activity-title">{activity.title}</Text>
              <Text className="activity-summary">{activity.summary}</Text>
              <Text className="activity-open">查看活动 ›</Text>
            </Button>
          ))}
        </View>
      ) : (
        <View className="activities-empty-state">
          <Text className="activities-empty-title">这一天暂无活动</Text>
          <Text className="activities-empty-copy">
            可更换日期，或清除筛选查看全部示例。
          </Text>
        </View>
      )}

      <Text className="activities-disclaimer">
        页面内容仅用于功能展示，不代表真实活动安排。
      </Text>
    </View>
  );
}
