import Taro from "@tarojs/taro";
import { Button, Text, View } from "@tarojs/components";
import "../public-info.css";

const HOME_SCHOOL_TOPICS = [
  {
    title: "日常观察",
    description: "围绕当日状态、学习进度与兴趣发现进行清楚沟通。",
  },
  {
    title: "共同陪伴",
    description: "让家长了解服务安排，也让孩子的表达得到尊重。",
  },
  {
    title: "信息边界",
    description: "只分享已确认且适合公开的内容，保护孩子和家庭隐私。",
  },
] as const;

export default function VisitorHomeSchool() {
  return (
    <View className="public-info-page">
      <Button
        className="return-button"
        onClick={() => void Taro.redirectTo({ url: "/pages/visitor/home/index" })}
      >
        ‹ 返回访客首页
      </Button>

      <View className="public-info-hero public-info-hero-warm">
        <Text className="public-info-eyebrow">同芯学园 · 访客公开信息</Text>
        <Text className="public-info-title">家校共育</Text>
        <Text className="public-info-summary">
          把每日观察变成家长看得懂的沟通，让家校合作更清晰、更安心。
        </Text>
      </View>

      <View className="public-info-section">
        <Text className="public-info-section-kicker">家校协作</Text>
        <Text className="public-info-section-title">沟通方式</Text>
        <Text className="public-info-copy">
          家校沟通示例围绕日常陪伴展开。真实通知、成长记录和联系信息应由机构确认后，再按授权范围提供给相应家庭。
        </Text>
      </View>

      <View className="public-info-card-list">
        {HOME_SCHOOL_TOPICS.map((topic, index) => (
          <View className="public-info-card" key={topic.title}>
            <Text className="public-info-card-index">{String(index + 1).padStart(2, "0")}</Text>
            <Text className="public-info-card-title">{topic.title}</Text>
            <Text className="public-info-card-copy">{topic.description}</Text>
          </View>
        ))}
      </View>

      <View className="public-info-actions">
        <Button
          className="public-info-action public-info-action-primary"
          onClick={() => void Taro.navigateTo({ url: "/pages/visitor/institution/index" })}
        >
          查看机构介绍
        </Button>
        <Button
          className="public-info-action"
          onClick={() => void Taro.navigateTo({ url: "/pages/visitor/day-flow/index" })}
        >
          查看一日流程
        </Button>
      </View>

      <View className="public-info-note">
        <Text className="public-info-note-title">模拟数据</Text>
        <Text className="public-info-note-copy">
          以上为家校共育示例，不连接真实机构、家庭或消息服务。
        </Text>
      </View>
    </View>
  );
}
