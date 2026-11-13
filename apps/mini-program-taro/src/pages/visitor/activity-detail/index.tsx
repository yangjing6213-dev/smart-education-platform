import Taro, { useRouter } from "@tarojs/taro";
import { Button, Text, View } from "@tarojs/components";
import { getVisitorActivity } from "../../../public/visitor-activities";
import "./index.css";

export default function VisitorActivityDetail() {
  const router = useRouter();
  const rawId = router.params?.id;
  const activity = getVisitorActivity(typeof rawId === "string" ? rawId : "");

  return (
    <View className="activity-detail-page">
      <Button
        className="activity-detail-return"
        onClick={() => void Taro.navigateBack()}
      >
        ‹ 返回活动列表
      </Button>

      {activity ? (
        <View className="activity-detail-card">
          <Text className="activity-detail-eyebrow">
            {activity.category} · {activity.date}
          </Text>
          <Text className="activity-detail-title">{activity.title}</Text>
          <Text className="activity-detail-summary">{activity.summary}</Text>
          <View className="activity-detail-body">
            {activity.details.map((paragraph) => (
              <Text className="activity-detail-paragraph" key={paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
          <Text className="activity-detail-note">模拟数据 · 公开活动示例</Text>
        </View>
      ) : (
        <View className="activity-detail-card">
          <Text className="activity-detail-title">未找到这条活动</Text>
          <Text className="activity-detail-summary">
            这条示例可能已不可用，请返回活动列表重新选择。
          </Text>
        </View>
      )}
    </View>
  );
}
