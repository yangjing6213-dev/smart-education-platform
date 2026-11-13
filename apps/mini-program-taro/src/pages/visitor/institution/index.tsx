import Taro from "@tarojs/taro";
import { Button, Text, View } from "@tarojs/components";
import "../public-info.css";

const INSTITUTION_PRINCIPLES = [
  {
    title: "尊重尝试",
    description: "给孩子保留表达、提问和重新开始的空间。",
  },
  {
    title: "清楚沟通",
    description: "用家长能理解的语言说明日常陪伴边界。",
  },
  {
    title: "先确认，再公开",
    description: "公开内容应经过确认，并符合信息使用授权。",
  },
] as const;

export default function VisitorInstitution() {
  return (
    <View className="public-info-page">
      <Button
        className="return-button"
        onClick={() => void Taro.redirectTo({ url: "/pages/visitor/home/index" })}
      >
        ‹ 返回访客首页
      </Button>

      <View className="public-info-hero">
        <Text className="public-info-eyebrow">同芯学园 · 访客公开信息</Text>
        <Text className="public-info-title">机构介绍</Text>
        <Text className="public-info-summary">
          用稳定的日常、清晰的边界和可理解的信息，陪伴孩子在放学后继续成长。
        </Text>
      </View>

      <View className="public-info-section">
        <Text className="public-info-section-kicker">我们是谁</Text>
        <Text className="public-info-section-title">了解课后成长服务</Text>
        <Text className="public-info-copy">
          同芯学园为访客介绍课后托管、学习整理与兴趣探索等服务方向。这里展示的是机构介绍示例，真实服务内容应以机构确认的信息为准。
        </Text>
      </View>

      <View className="public-info-section">
        <Text className="public-info-section-kicker">服务原则</Text>
        <Text className="public-info-section-title">把重要的事情说清楚</Text>
        <View className="public-info-card-list">
          {INSTITUTION_PRINCIPLES.map((principle, index) => (
            <View className="public-info-card" key={principle.title}>
              <Text className="public-info-card-index">{String(index + 1).padStart(2, "0")}</Text>
              <Text className="public-info-card-title">{principle.title}</Text>
              <Text className="public-info-card-copy">{principle.description}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="public-info-actions">
        <Button
          className="public-info-action public-info-action-primary"
          onClick={() => void Taro.navigateTo({ url: "/pages/visitor/day-flow/index" })}
        >
          查看一日流程
        </Button>
        <Button
          className="public-info-action"
          onClick={() => void Taro.navigateTo({ url: "/pages/visitor/home-school/index" })}
        >
          了解家校共育
        </Button>
      </View>

      <View className="public-info-note">
        <Text className="public-info-note-title">模拟数据</Text>
        <Text className="public-info-note-copy">
          以上为访客介绍示例，不代表任何真实机构政策或服务承诺。
        </Text>
      </View>
    </View>
  );
}
