import Taro from "@tarojs/taro";
import { Button, Text, View } from "@tarojs/components";
import { INSTITUTION_CULTURE, INSTITUTION_INTRODUCTION } from "../../../public/institution-profile";
import "../public-info.css";

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
        <Text className="public-info-eyebrow">同芯学园</Text>
        <Text className="public-info-title">机构介绍</Text>
        <Text className="public-info-summary">{INSTITUTION_INTRODUCTION}</Text>
      </View>

      <View className="public-info-section">
        <Text className="public-info-section-title">企业文化</Text>
        <View className="public-info-card-list">
          {INSTITUTION_CULTURE.map(({ title, description }) => (
            <View className="public-info-card" key={title}>
              <Text className="public-info-card-title">{title}</Text>
              <Text className="public-info-card-copy">{description}</Text>
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
    </View>
  );
}
