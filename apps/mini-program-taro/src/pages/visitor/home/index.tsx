import Taro from "@tarojs/taro";
import { Button, Image, Text, View } from "@tarojs/components";
import institutionActivityPhoto from "../../../assets/institution-activity-visit.jpg";
import teacherTeamCampus from "../../../assets/teacher-team-campus.jpg";
import teacherTeamOutdoor from "../../../assets/teacher-team-outdoor.jpg";
import { INSTITUTION_INTRODUCTION } from "../../../public/institution-profile";
import "./index.css";

export default function VisitorHome() {
  return (
    <View className="page">
      <View className="brand">
        <View className="brand-mark">心</View>
        <View>
          <Text className="brand-name">同芯学园</Text>
          <Text className="brand-subtitle">TONG XIN XUE YUAN</Text>
        </View>
      </View>

      <View className="hero-card">
        <Text className="headline">做有温度的教育，</Text>
        <Text className="headline headline-accent">温暖孩子成长路。</Text>
        <Text className="description">{INSTITUTION_INTRODUCTION}</Text>
        <Image
          className="institution-activity-photo"
          src={institutionActivityPhoto}
          mode="aspectFill"
          ariaLabel="同芯学园校园活动现场"
        />
      </View>

      <Button
        className="visitor-institution-button"
        onClick={() => void Taro.navigateTo({ url: "/pages/visitor/institution/index" })}
      >
        了解同芯学园
      </Button>

      <Button
        className="visitor-login-button"
        onClick={() => void Taro.navigateTo({ url: "/pages/auth/login/index" })}
      >
        家长与员工登录
      </Button>

      <View className="section-heading">
        <Text className="section-mark">芽</Text>
        <View>
          <Text className="section-title">我的成长</Text>
          <Text className="section-subtitle">陪伴每一次进步</Text>
        </View>
      </View>

      <View className="service-list">
        <View className="service-card">
          <Text className="service-title">课后托管</Text>
          <Text className="service-copy">安全看护 · 作业辅导</Text>
        </View>
        <View className="service-card service-card-warm">
          <Text className="service-title">兴趣课程</Text>
          <Text className="service-copy">多元探索 · 发现潜能</Text>
        </View>
        <Button
          aria-label="打开家校共育"
          className="service-card service-card-link"
          onClick={() => void Taro.navigateTo({ url: "/pages/visitor/home-school/index" })}
        >
          <Text className="service-title">家校沟通</Text>
          <Text className="service-copy">成长反馈 · 携手共育</Text>
        </Button>
      </View>

      <View className="section-heading teacher-team-heading">
        <Text className="section-mark">师</Text>
        <View>
          <Text className="section-title">教师团队</Text>
          <Text className="section-subtitle">用心陪伴每一次成长</Text>
        </View>
      </View>

      <View className="teacher-team-list">
        <View className="teacher-team-card">
          <Image
            className="teacher-team-photo"
            src={teacherTeamOutdoor}
            mode="aspectFill"
            ariaLabel="同芯学园教师团队户外合影"
          />
          <Text className="teacher-team-caption">教师团队户外合影</Text>
        </View>
        <View className="teacher-team-card">
          <Image
            className="teacher-team-photo"
            src={teacherTeamCampus}
            mode="aspectFill"
            ariaLabel="同芯学园教师团队校区合影"
          />
          <Text className="teacher-team-caption">教师团队校区合影</Text>
        </View>
      </View>

      <View className="section-heading news-heading">
        <Text className="section-mark section-mark-sun">☀</Text>
        <View>
          <Text className="section-title">校园动态</Text>
          <Text className="section-subtitle">记录温暖的日常</Text>
        </View>
      </View>

      <View
        className="news-card"
        onClick={() => void Taro.navigateTo({ url: "/pages/visitor/activities/index" })}
      >
        <Text className="news-title">活动分享</Text>
        <Text className="news-copy">精彩瞬间 · 共同见证</Text>
      </View>
      <View
        className="news-card news-card-warm"
        onClick={() => void Taro.navigateTo({ url: "/pages/visitor/day-flow/index" })}
      >
        <Text className="news-title">一日流程</Text>
        <Text className="news-copy">科学安排 · 充实每一天</Text>
      </View>

      <Button
        className="visitor-meals-button"
        aria-label="查看餐食安排"
        onClick={() => void Taro.navigateTo({ url: "/pages/visitor/meals/index" })}
      >
        餐食安排
      </Button>
    </View>
  );
}
