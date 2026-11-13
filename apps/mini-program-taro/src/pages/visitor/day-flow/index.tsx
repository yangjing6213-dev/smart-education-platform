import Taro from "@tarojs/taro";
import { useState } from "react";
import { Button, Text, View } from "@tarojs/components";
import "./index.css";

const DAY_FLOW_STEPS = [
  {
    time: "15:30",
    title: "到校整理",
    description: "整理随身物品，准备开始课后时光。",
  },
  {
    time: "16:00",
    title: "作业与阅读",
    description: "按自己的节奏完成学习任务，也留一点时间阅读。",
  },
  {
    time: "17:00",
    title: "兴趣活动",
    description: "参加轻松的动手活动，和同伴分享发现。",
  },
];

export default function VisitorDayFlow() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <View className="day-flow-page">
      <Button
        className="return-button"
        onClick={() =>
          void Taro.redirectTo({ url: "/pages/visitor/home/index" })
        }
      >
        ‹ 返回访客首页
      </Button>

      <View className="day-flow-hero">
        <Text className="day-flow-eyebrow">同芯学园 · 访客公开信息</Text>
        <Text className="day-flow-title">一日流程</Text>
        <Text className="day-flow-intro">
          看看放学后的时光如何安排，选择一个时段了解更多。
        </Text>
      </View>

      <View className="day-flow-list">
        {DAY_FLOW_STEPS.map((step, index) => (
          <Button
            key={step.time}
            className={`flow-step${activeStep === index ? " flow-step-active" : ""}`}
            onClick={() => setActiveStep(index)}
          >
            <Text className="flow-time">{step.time}</Text>
            <View className="flow-step-copy">
              <Text className="flow-step-title">{step.title}</Text>
              {activeStep === index ? (
                <Text className="flow-step-description">
                  {step.description}
                </Text>
              ) : null}
            </View>
            <Text className="flow-step-marker">
              {activeStep === index ? "✓" : "›"}
            </Text>
          </Button>
        ))}
      </View>

      <View className="day-flow-note">
        <Text className="day-flow-note-title">模拟数据</Text>
        <Text className="day-flow-note-copy">
          以上内容仅为示例，不代表任何真实校区排班。
        </Text>
      </View>
    </View>
  );
}
