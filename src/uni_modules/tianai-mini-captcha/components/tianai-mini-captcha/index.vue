<template>
  <view
    v-if="verifyShow"
    class="zf-cap"
    :class="{
      'zf-cap-reference': referenceLayout,
      'zf-cap-reference-rotate': referenceLayout && type === 'ROTATE',
      'is-dragging': dragging,
      'is-ok': isSuccess,
      'is-err': isErr,
      'is-closing': closing,
    }"
  >
    <!-- 遮罩：点击不关闭（防误触），仅 ✕ / Esc 关闭 -->
    <view class="zf-cap-mask"></view>
    <view class="zf-cap-modal">
      <view class="zf-cap-close" @click="close">
        <zf-icon name="close" :size="20" color="#9AA3B2" />
      </view>
      <view class="zf-cap-head">
        <view class="zf-cap-title">
          <zf-icon name="shield" :size="15" />
          <text>安全验证</text>
        </view>
        <view class="zf-cap-sub">{{ subTip }}</view>
      </view>

      <!-- SLIDER  ROTATE  CONCAT 类型 -->
      <block v-if="type !== 'WORD_IMAGE_CLICK'">
        <view class="zf-cap-img">
          <view class="verify-bg">
            <image
              id="bg"
              :src="captchaData.background_image"
              :mode="type === 'ROTATE' ? 'aspectFill' : 'heightFix'"
              @load="onCaptchaImgLoad"
            >
            </image>
          </view>
          <view
            v-if="type === 'CONCAT'"
            id="verify-concat-bg"
            class="verify-concat-bg"
            :style="imgStyle"
          >
          </view>
          <view v-else class="verify-slider" :style="imgStyle">
            <image
              id="slider-img"
              :src="captchaData.slider_image"
              :mode="referenceLayout && type === 'ROTATE' ? 'aspectFill' : 'heightFix'"
              @load="onCaptchaImgLoad"
            ></image>
          </view>
          <view class="zf-cap-tint"></view>
          <view v-if="!ready" class="zf-cap-skeleton"></view>
          <view v-if="isSuccess" class="zf-cap-bar zf-cap-bar--ok">
            <view class="icon"><zf-icon name="check" :size="14" color="#FFFFFF" /></view>
            <text>验证通过，用时 {{ elapsedText }}s</text>
          </view>
          <view v-if="isErr" class="zf-cap-bar zf-cap-bar--err">
            <view class="icon"><zf-icon name="close" :size="14" color="#FFFFFF" /></view>
            <text>{{ errorText }}</text>
          </view>
        </view>

        <view
          v-if="isActive"
          class="zf-cap-track"
          @touchstart="touchstart"
          @touchmove="touchmove"
          @touchend="touchend"
        >
          <view class="zf-cap-fill" :style="{ width: colorWidth + 'px' }"></view>
          <view v-if="showHint" class="zf-cap-hint">{{ hintText }}</view>
          <movable-area class="zf-cap-area">
            <movable-view
              class="zf-cap-handle"
              :x="x"
              :disabled="!ready"
              :animation="true"
              direction="horizontal"
              role="slider"
              aria-label="拖动完成拼图验证"
              aria-valuemin="0"
              :aria-valuemax="captchaData.end"
              :aria-valuenow="Math.round(leftDistance)"
              @change="StartMove"
              @touchstart="onSliderDown"
              @mousedown="onSliderDown"
            >
              <zf-icon v-if="isSuccess" class="icon-ok" name="check" :size="18" color="#FFFFFF" />
              <zf-icon v-else-if="isErr" class="icon-err" name="close" :size="18" color="#FFFFFF" />
              <zf-icon v-else name="chevron-right" :size="18" color="#FFFFFF" />
            </movable-view>
          </movable-area>
        </view>
      </block>

      <!-- 点选 -->
      <block v-else>
        <view class="zf-cap-clicktips">
          <text>请依次点击:</text>
          <image :src="captchaData.slider_image" mode="scaleToFill" />
        </view>
        <view class="zf-cap-img">
          <view class="verify-bg">
            <image id="bg" :src="captchaData.background_image" mode="heightFix" @load="onCaptchaImgLoad">
            </image>
          </view>
          <view class="zf-cap-tint"></view>
          <view v-if="!ready" class="zf-cap-skeleton"></view>
          <!-- 点击蒙层 -->
          <view
            id="image-click-mask"
            class="image-click-mask"
            @click="recordClickItem"
          >
            <view
              v-for="(item, index) in captchaData.trackArr"
              :key="index"
              class="click-item"
              :style="{ left: `${item.x - 15}px`, top: `${item.y - 15}px` }"
              >{{ index + 1 }}</view
            >
          </view>
          <view v-if="isSuccess" class="zf-cap-bar zf-cap-bar--ok">
            <view class="icon"><zf-icon name="check" :size="14" color="#FFFFFF" /></view>
            <text>验证通过，用时 {{ elapsedText }}s</text>
          </view>
          <view v-if="isErr" class="zf-cap-bar zf-cap-bar--err">
            <view class="icon"><zf-icon name="close" :size="14" color="#FFFFFF" /></view>
            <text>{{ errorText }}</text>
          </view>
        </view>
      </block>

      <!-- footer 操作区 -->
      <view class="zf-cap-foot">
        <view
          class="zf-cap-refresh"
          :class="{ 'is-spinning': spinning }"
          @click="onRefreshTap"
        >
          <zf-icon name="refresh" :size="16" color="#5A6B8C" />
          <text>换一张</text>
        </view>
        <view class="brand">
          <zf-icon name="shield" :size="13" />
          <text>{{ $brandName }}安全验证</text>
        </view>
      </view>
    </view>
  </view>
</template>
<script>

export default {
  name: "verify-code",
  props: {
    type: {
      type: String,
      default: "SLIDER",
      validator: (val) => {
        return (
          ["SLIDER", "CONCAT", "ROTATE", "WORD_IMAGE_CLICK"].indexOf(val) !== -1
        );
      },
    },
    conf: {
      type: Object,
      defalut: () => ({
        gen: "",
        validate: "",
      }),
    },
  },
  data() {
    return {
      referenceLayout: false,
      verifyShow: false,
      closing: false, //退场动画播放中（capOut/capBounceIn reverse，260ms 后卸载）
      isActive: true, //刷新滑块
      ready: false, //几何尺寸是否就绪（就绪前禁止拖动，避免参考系中途突变）
      submitted: false, //本次手势是否已提交校验（松手可能由 movable-view/外层多处触发，幂等防重复提交）
      spinning: false, //换一张按钮旋转动画
      lastRefreshAt: 0, //换一张节流 ≥1s，防连点刷接口
      failCount: 0, //连续失败计数，≥5 次冷却
      cooldownUntil: 0, //冷却截止时间戳
      elapsedMs: 0, //本次验证用时（成功条文案）
      colorWidth: 40, //进度填充宽 = 把手位移 + 40px
      leftDefault: 0,
      leftDistance: 0, //默认卡片位置固定为靠左
      isSuccess: false, //验证成功
      isErr: false, //验证失败
      errorText: "验证失败，请重新尝试！",
      x: 0, //滑块的X距离
      xpos: 0, //读取X滑动的距离
      bgImg: {
        //当前环境滑块背景尺寸
        width: 0,
        height: 0,
      },
      sliderImg: {
        //当前环境滑块尺寸
        width: 0,
        height: 0,
      },
      captchaData: {
        id: null, //当前生成的滑块ID, 后端生成
        background_image: "", //滑块背景图
        slider_image: "", //滑块图片
        startTime: new Date(), //起始时间
        trackArr: [], //滑动轨迹
        movePercent: 0, //滑动距离与背景图百分比
        background_image_width: 0, //当前环境滑块背景宽
        background_image_height: 0, //当前环境滑块背景高
        slider_image_width: 0, //当前环境滑块宽
        slider_image_height: 0, //当前环境滑块高
        end: 206, //滑块滑动界限值
        rotate_travel: 0, //ROTATE 滑块物理行程(滑轨宽−按钮宽)，满行程映射 360°
      },
      timeout: null,
      // 点击序号
      clickCount: 0,
      dragging: false, //是否正在拖滑块（仅当 mousedown/touchstart 落在 movable-view 上才置位，闸住 document 级松手）
    };
  },
  // H5 上 movable-view 用 useTouchtrack：鼠标拖拽的 mousemove/mouseup 挂在 document 上，
  // 松手落点不在按钮上 → 元素级 @mouseup 收不到。故把"拖拽结束→提交"挂到 document 级，
  // touch/mouse 都能可靠捕获；用 dragging 闸位避免误触发（点刷新/关闭等不提交）。
  mounted() {
    if (typeof document === "undefined") return;
    this._onDocPointerUp = (e) => this.onSliderUp(e);
    document.addEventListener("mouseup", this._onDocPointerUp);
    document.addEventListener("touchend", this._onDocPointerUp);
    this._onKeydown = (e) => {
      if (e.key === "Escape" && this.verifyShow && !this.closing) this.close();
    };
    document.addEventListener("keydown", this._onKeydown);
  },
  beforeUnmount() {
    if (typeof document === "undefined") return;
    if (this._onDocPointerUp) {
      document.removeEventListener("mouseup", this._onDocPointerUp);
      document.removeEventListener("touchend", this._onDocPointerUp);
    }
    if (this._onKeydown) {
      document.removeEventListener("keydown", this._onKeydown);
    }
  },
  methods: {
    open() {
      if (Date.now() < this.cooldownUntil) {
        uni.showToast({ title: "失败次数过多，请稍后再试", icon: "none" });
        return;
      }
      this.failCount = 0;
      this.closing = false;
      this.debounce(this.getVerifyData, 80);
      this.verifyShow = true;
    },
    close() {
      if (this.closing || !this.verifyShow) return;
      // 先播退场动画（.is-closing → capOut），播完再卸载重置；时长与 --cap-dur-out 同步
      this.closing = true;
      setTimeout(() => {
        this.verifyShow = false;
        this.closing = false;
        this.ready = false;
        this.submitted = false;
        this.dragging = false;
        if (this._geomFallback) {
          clearTimeout(this._geomFallback);
          this._geomFallback = null;
        }
        this.$nextTick(() => {
          this.captchaData = {
            id: null, //当前生成的滑块ID, 后端生成
            background_image: "", //滑块背景图
            slider_image: "", //滑块图片
            startTime: new Date(), //起始时间
            trackArr: [], //滑动轨迹
            movePercent: 0, //滑动距离与背景图百分比
            background_image_width: 0, //当前环境滑块背景宽
            background_image_height: 0, //当前环境滑块背景高
            slider_image_width: 0, //当前环境滑块宽
            slider_image_height: 0, //当前环境滑块高
            end: 206, //滑块滑动界限值
            rotate_travel: 0, //ROTATE 滑块物理行程(滑轨宽−按钮宽)，满行程映射 360°
          };
          this.isActive = false;
          this.$nextTick(() => {
            this.isActive = true;
          });
          this.colorWidth = 0;
          this.x = this.xpos;
          this.$nextTick(function () {
            this.x = 0;
            this.colorWidth = 40;
          });
          this.isErr = false;
          this.isSuccess = false;
          this.leftDistance = 0;
        });
      }, 260);
    },
    recordClickItem(e) {
      if (!this.ready) return; //几何未就绪前忽略点选
      // H5 的 click 是 MouseEvent(没有 touches);小程序/App 才有 touches。
      // 兼容三端取点击坐标,优先 pageX(与原小程序/App 行为一致),回退 detail / clientX。
      const point =
        (e.touches && e.touches[0]) ||
        (e.detail && e.detail.x != null ? e.detail : null) ||
        e;
      const x = point.pageX != null ? point.pageX : point.clientX != null ? point.clientX : point.x;
      const y = point.pageY != null ? point.pageY : point.clientY != null ? point.clientY : point.y;
      const relativeX = this.sliderImg.left - x;
      const relativeY = this.sliderImg.top - y;
      this.clickCount++;

      const startTime = this.captchaData.startTime;

      if (this.clickCount > 4) {
        return;
      }

      this.captchaData.stopTime = new Date();

      const track = {
        x: Math.abs(relativeX),
        y: Math.abs(relativeY),
        type: "click",
        t: Date.now() - startTime.getTime(),
      };

      this.captchaData.trackArr.push(track);

      if (this.clickCount == 4) {
        this.setVertifyData();
      }
    },

    // 滑块初始位置
    touchstart(e) {
      if (!this.ready) return; //几何未就绪前忽略拖动
      this.submitted = false; //新一轮手势开始，解锁提交
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      let startX = t.pageX;
      let startY = t.pageY;
      this.captchaData.startX = startX;
      this.captchaData.startY = startY;
      const pageX = this.captchaData.startX;
      const pageY = this.captchaData.startY;
      const startTime = this.captchaData.startTime;
      const trackArr = this.captchaData.trackArr;
      trackArr.push({
        x: pageX - startX,
        y: pageY - startY,
        type: "down",
        t: Date.now() - startTime.getTime(),
      });
    },
    // 滑块滑动中位置
    touchmove(e) {
      if (!this.ready) return;
      let pageX = Math.round(e.changedTouches[0].pageX);
      let pageY = Math.round(e.changedTouches[0].pageY);
      const startX = this.captchaData.startX;
      const startY = this.captchaData.startY;
      const startTime = this.captchaData.startTime;
      const end = this.captchaData.end;
      const bgImageWidth = this.captchaData.background_image_width;
      const trackArr = this.captchaData.trackArr;
      let moveX = pageX - startX;
      const track = {
        x: pageX - startX,
        y: pageY - startY,
        type: "move",
        t: Date.now() - startTime.getTime(),
      };
      trackArr.push(track);
      if (moveX < 0) {
        moveX = 0;
      } else if (moveX > end) {
        moveX = end;
      }
      this.captchaData.moveX = moveX;
      this.captchaData.movePercent = moveX / bgImageWidth;
    },
    // 滑块停止滑动
    touchend(e) {
      // 松手提交：同时挂在 movable-view 和外层滑轨上，H5 里只要有一处触发即可，
      // submitted 锁保证一次手势只提交一次。不再依赖 e.changedTouches（mouseup/部分 H5
      // 的 movable-view touchend 没有触点），缺触点时跳过末点采集，由 setVertifyData 兜底。
      if (!this.ready || this.submitted) return;
      this.submitted = true;
      this.captchaData.stopTime = new Date();
      const t = e && e.changedTouches && e.changedTouches[0];
      if (t) {
        const startX = this.captchaData.startX || 0;
        const startY = this.captchaData.startY || 0;
        const startTime = this.captchaData.startTime;
        this.captchaData.trackArr.push({
          x: Math.round(t.pageX) - startX,
          y: Math.round(t.pageY) - startY,
          type: "up",
          t: Date.now() - startTime.getTime(),
        });
      }
      this.setVertifyData();
    },
    // 滑块绑定卡片移动距离
    StartMove(e) {
      if (!this.ready) return; //几何未就绪前不响应位移，避免用旧参考系计算角度
      this.xpos = e.detail.x;
      this.$nextTick(() => {
        this.colorWidth = this.xpos + 40; //进度填充宽 = 位移 + 40px
        this.leftDistance = this.xpos;
      });
    },
    // 按下滑块按钮：标记一次真实拖拽开始（mouse/touch 都从按钮上起手），解锁本轮提交
    onSliderDown() {
      if (!this.ready) return;
      this.dragging = true;
      this.submitted = false;
    },
    // document 级松手：只有真在拖滑块时才提交，避免点刷新/关闭等误触发
    onSliderUp(e) {
      if (!this.dragging) return;
      this.dragging = false;
      this.touchend(e);
    },
    // 获取背景图和滑块图片
    getVerifyData() {
      this.ready = false; //新一轮验证码加载完成前禁止拖动
      this.clickCount = 0;
      this.captchaData.trackArr = [];
      this.captchaData.startTime = new Date();
      uni.request({
        url: `${this.conf.gen}?type=${this.type}`,
        method: "get",
        success: ({ data }) => {
          this.captchaData.id = data.id;
          this._rawCaptcha = data.captcha; // CONCAT 高度计算需要原始数据
          this.captchaData.background_image = data.captcha?.backgroundImage;
          this.captchaData.slider_image = data.captcha?.templateImage;

          // 先尝试一次测量（H5 等平台布局可立即就绪）；
          // 真正放开拖动以图片 @load 为准（见 onCaptchaImgLoad / measureGeometry），
          // 确保布局稳定、几何尺寸准确，避免“马上拖”用到未就绪的参考系导致拼错。
          this.$nextTick(() => this.measureGeometry());
          if (this._geomFallback) clearTimeout(this._geomFallback);
          this._geomFallback = setTimeout(() => this.measureGeometry(), 800);
        },
        fail: (e) => {
          console.error("获取验证码失败", e);
        },
      });
    },
    // 背景/滑块图片加载完成回调：此时布局已稳定，测量最可靠
    onCaptchaImgLoad() {
      this.measureGeometry();
    },
    // 测量渲染尺寸并初始化配置（幂等：本轮成功一次后不再重复）。
    // 仅在测到有效尺寸后才放开拖动，规避不同平台“测量过早 → 几何参考系不准”的问题。
    measureGeometry() {
      if (this.ready) return;
      const query = uni.createSelectorQuery().in(this);
      query.select("#bg").boundingClientRect();
      if (this.type === "ROTATE" || this.type === "SLIDER") {
        query.select("#slider-img").boundingClientRect();
      } else if (this.type === "CONCAT") {
        query.select("#verify-concat-bg").boundingClientRect();
      } else if (this.type === "WORD_IMAGE_CLICK") {
        query.select("#image-click-mask").boundingClientRect();
      }
      if (this.referenceLayout && this.type === "ROTATE") {
        query.select(".zf-cap-area").boundingClientRect();
        query.select(".zf-cap-handle").boundingClientRect();
      }
      query.exec((rects = []) => {
        const bgRect = rects[0];
        const subRect = rects[1];
        // 背景尺寸还没量到（布局未就绪）→ 放弃本次，等 @load / 兜底定时器再测
        if (!bgRect || !bgRect.width) return;
        // 旋转/滑块依赖滑块尺寸，必须一并量到才算就绪
        if ((this.type === "ROTATE" || this.type === "SLIDER") && !subRect) return;
        this.bgImg.width = bgRect.width;
        this.bgImg.height = bgRect.height;
        if (this.type === "ROTATE" || this.type === "SLIDER") {
          this.sliderImg.width = subRect.width;
          this.sliderImg.height = subRect.height;
        } else if (this.type === "CONCAT") {
          if (subRect && this._rawCaptcha) {
            const height =
              ((this._rawCaptcha.backgroundImageHeight -
                this._rawCaptcha.data.randomY) /
                this._rawCaptcha.backgroundImageHeight) *
              uni.upx2px(this._rawCaptcha.backgroundImageHeight);
            this.sliderImg.height = height;
          }
        } else if (this.type === "WORD_IMAGE_CLICK") {
          if (subRect) {
            this.sliderImg.left = subRect.left;
            this.sliderImg.top = subRect.top;
          }
        }
        this.captchaData.end = this.bgImg.width - uni.upx2px(40);
        // ROTATE 旋转盘：滑块物理行程 = 滑轨宽(==背景图宽) − 把手宽 42px − 轨内边距 4px，
        // 恰好等于 movable-view 最大可移动距离。用它把"满行程"映射到 360°，
        // 使旋转能转满一圈、且与后端 x/bgImageWidth 判定口径一致。
        this.captchaData.rotate_travel = this.referenceLayout && rects[2] && rects[3]
          ? rects[2].width - rects[3].width
          : Math.round(this.bgImg.width - 46);
        this.initConfig(
          this.bgImg.width,
          this.bgImg.height,
          this.sliderImg.width,
          this.sliderImg.height,
          this.captchaData.end
        );
        if (this._geomFallback) {
          clearTimeout(this._geomFallback);
          this._geomFallback = null;
        }
        // 几何尺寸就绪后才放开拖动（startTime 也重置为此刻，避免轨迹耗时异常）
        this.captchaData.startTime = new Date();
        this.captchaData.trackArr = [];
        this.submitted = false;
        this.ready = true;
      });
    },
    // 初始化配置
    initConfig(
      bgImageWidth,
      bgImageHeight,
      sliderImageWidth,
      sliderImageHeight,
      end
    ) {
      this.captchaData.background_image_width = Math.round(bgImageWidth);
      this.captchaData.background_image_height = Math.round(bgImageHeight);
      this.captchaData.slider_image_width = Math.round(sliderImageWidth);
      this.captchaData.slider_image_height = Math.round(sliderImageHeight);
      this.captchaData.end = Math.round(end);
    },
    // 校验是否成功
    setVertifyData() {
      // 后端判定固定为 lastTrack.x / bgImageWidth。仅 ROTATE 改成与视觉同源的口径：
      // 上报 bgImageWidth = 滑块物理行程，最后一点 x = leftDistance(视觉旋转所用值)，
      // 使 percentage = leftDistance/行程 = 视觉分数 f，对正即过、满圈可达。
      // 其它类型(SLIDER/CONCAT/WORD_IMAGE_CLICK)保持原逻辑不变。
      let bgImageWidth = this.captchaData.background_image_width;
      let trackList = this.captchaData.trackArr;
      if (this.type === "ROTATE") {
        bgImageWidth =
          this.captchaData.rotate_travel || this.captchaData.background_image_width;
        if (trackList.length) {
          const last = trackList.length - 1;
          trackList[last] = { ...trackList[last], x: this.leftDistance };
        } else {
          // H5 上 movable-view 吞掉外层 touch 轨迹时为空：旋转角度全程由 leftDistance 维护，
          // 这里直接用它兜底构造首末点，保证后端取到的 lastTrack.x = leftDistance、不至于空轨迹报错。
          const elapsed = Date.now() - new Date(this.captchaData.startTime).getTime();
          trackList = [
            { x: 0, y: 0, type: "down", t: 0 },
            { x: this.leftDistance, y: 0, type: "up", t: elapsed },
          ];
        }
      }
      const dataForm = {
        id: this.captchaData.id,
        data: {
          bgImageWidth: bgImageWidth,
          bgImageHeight: this.captchaData.background_image_height,
          startTime: this.captchaData.startTime,
          stopTime: this.captchaData.stopTime,
          trackList: trackList,
        },
      };

      uni.request({
        url: `${this.conf.validate}?type=${this.type}`,
        method: "post",
        data: dataForm,
        success: (res) => {
          if (["000000", 200].includes(res.data.code) && res.data.data) {
            this.isSuccess = true;
            this.failCount = 0;
            this.elapsedMs =
              new Date(this.captchaData.stopTime).getTime() -
              new Date(this.captchaData.startTime).getTime();
            // 成功条展示 800ms 后关闭并回调放行
            let tm = setTimeout(() => {
              clearTimeout(tm);
              this.close();
              this.$emit("success", res.data.data);
            }, 800);
          } else {
            if (res.data.code == 4001) {
              this.isErr = true;
              this.errorText = this.alignFailText;
              this.failCount++;
            } else if (res.data.code == 4000) {
              this.isErr = true;
              this.errorText = "验证码被黑洞吸走了！";
              this.failCount++;
            } else {
              uni.showToast({
                title: res.data.msg,
                icon: "none",
              });
            }
            // 失败展示 1100ms 后回弹归零并换图；连续失败 ≥5 次冷却 60s
            let tm = setTimeout(() => {
              clearTimeout(tm);
              if (this.failCount >= 5) {
                this.cooldownUntil = Date.now() + 60 * 1000;
                uni.showToast({ title: "失败次数过多，请稍后再试", icon: "none" });
                this.close();
              } else {
                this.refresh();
              }
            }, 1100);
          }
        },
        fail: (err) => {
          this.refresh();
        },
      });
    },
    // 换一张按钮：节流 ≥1s 防连点刷接口，点击图标旋转一周
    onRefreshTap() {
      const now = Date.now();
      if (now - this.lastRefreshAt < 1000) return;
      this.lastRefreshAt = now;
      this.spinning = true;
      setTimeout(() => {
        this.spinning = false;
      }, 700);
      this.refresh();
    },
    // 刷新滑块
    refresh() {
      this.isActive = false;

      this.$nextTick(() => {
        this.isActive = true;
      });
      this.colorWidth = 0;
      this.x = this.xpos;
      this.$nextTick(function () {
        this.x = 0;
        this.colorWidth = 40;
      });

      this.isErr = false;
      this.isSuccess = false;
      this.leftDistance = 0;
      this.clickCount = 0;
      this.submitted = false;
      this.dragging = false;
      this.captchaData.trackArr = [];
      this.getVerifyData();
    },
    debounce(func, wait = 500, immediate = false) {
      // 清除定时器
      if (this.timeout !== null) clearTimeout(this.timeout);
      // 立即执行，此类情况一般用不到
      if (immediate) {
        const callNow = !this.timeout;
        this.timeout = setTimeout(() => {
          this.timeout = null;
        }, wait);
        if (callNow) typeof func === "function" && func();
      } else {
        this.timeout = setTimeout(() => {
          typeof func === "function" && func();
        }, wait);
      }
    },
  },
  computed: {
    imgStyle() {
      if (this.type === "ROTATE") {
        // 用滑块"满行程"映射 360°：分母取滑块物理行程(滑轨宽−把手46)而非背景图宽，
        // 否则按钮永远走不到背景图宽，最大只能转 ~300° → 转不满一圈。
        const travel =
          this.captchaData.rotate_travel ||
          this.bgImg.width - 46 ||
          this.captchaData.end;
        const f = Math.min(1, Math.max(0, this.leftDistance / travel));
        const angle = f * 360;
        return this.referenceLayout
          ? `transform:rotate(${angle}deg);`
          : `transform:translate(100%,0) rotate(${angle}deg);`;
      }
      if (this.type === "SLIDER") {
        return `left: ${this.leftDistance}px;`;
      }

      if (this.type === "CONCAT") {
        return `background-position:${this.leftDistance}px 0;background-image:url(${this.captchaData.background_image});background-size: cover;height:${this.sliderImg.height}px`;
      }
    },
    // 头部副标题（按类型区分口径）
    subTip() {
      if (this.type === "ROTATE") return this.referenceLayout
        ? "拖动滑块，将图片转正"
        : "拖动下方滑块，使图片角度为正";
      if (this.type === "WORD_IMAGE_CLICK") return "请按顺序点击图中文字";
      return "拖动下方滑块，将拼图滑入缺口";
    },
    // 滑轨空闲提示（流光文案，开始拖动即隐藏）
    hintText() {
      if (this.type === "ROTATE") return this.referenceLayout
        ? "向右拖动滑块"
        : "向右拖动滑块完成验证 »";
      return "向右拖动滑块完成拼图 »";
    },
    showHint() {
      return (
        this.ready &&
        !this.dragging &&
        this.leftDistance <= 0 &&
        !this.isErr &&
        !this.isSuccess
      );
    },
    // 未对齐失败文案（按类型区分口径）
    alignFailText() {
      if (this.type === "ROTATE") return "验证失败，角度未对正，请重试";
      if (this.type === "WORD_IMAGE_CLICK") return "验证失败，请重新尝试";
      return "验证失败，拼图未对齐，请重试";
    },
    elapsedText() {
      return (this.elapsedMs / 1000).toFixed(1);
    },
  },
};
</script>

<!-- 视觉样式统一在 styles/captcha.scss（zf-cap-* + --cap-* 令牌），随 App.vue 全局引入 -->
