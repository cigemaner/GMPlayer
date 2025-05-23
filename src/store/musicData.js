import { defineStore } from "pinia";
import { nextTick } from "vue";
import { getSongTime, getSongPlayingTime } from "@/utils/timeTools";
import { getPersonalFm, setFmTrash } from "@/api/home";
import { getLikelist, setLikeSong } from "@/api/user";
import { getPlayListCatlist } from "@/api/playlist";
import { userStore, settingStore } from "@/store";
import { NIcon } from "naive-ui";
import { PlayCycle, PlayOnce, ShuffleOne } from "@icon-park/vue-next";
import { soundStop, fadePlayOrPause } from "@/utils/Player";
import { parseLyric } from "@/utils/parseLyric";
import getLanguageData from "@/utils/getLanguageData";
import { preprocessLyrics } from "@/libs/apple-music-like/processLyrics";

const useMusicDataStore = defineStore("musicData", {
  state: () => {
    return {
      // 是否展示播放界面
      showBigPlayer: false,
      // 是否展示播放控制条
      showPlayBar: true,
      // 是否展示播放列表
      showPlayList: false,
      // 播放状态
      playState: false,
      // 当前歌曲歌词数据
      songLyric: {
        lrc: [],
        yrc: [],
        lrcAMData: [],
        yrcAMData: [],
        hasTTML: false,     // 是否拥有TTML格式歌词
        ttml: [],           // TTML解析后的数据
        hasLrcTran: false,
        hasLrcRoma: false,
        hasYrc: false,
        hasYrcTran: false,
        hasYrcRoma: false
      },
      // 当前歌曲歌词播放索引
      playSongLyricIndex: 0,
      // 每日推荐
      dailySongsData: [],
      // 歌单分类
      catList: {},
      // 精品歌单分类
      highqualityCatList: [],
      // 音乐频谱数据
      spectrumsData: [],
      spectrumsScaleData: 1,
      // 是否正在加载数据
      isLoadingSong: false,
      // 持久化数据
      persistData: {
        // 搜索历史
        searchHistory: [],
        // 是否处于私人 FM 模式
        personalFmMode: false,
        // 私人 FM 数据
        personalFmData: {},
        // 播放列表类型
        playListMode: "list",
        // 喜欢音乐列表
        likeList: [],
        // 播放列表
        playlists: [],
        // 当前歌曲索引
        playSongIndex: 0,
        // 当前播放模式
        // normal-顺序播放 random-随机播放 single-单曲循环
        playSongMode: "normal",
        // 当前播放时间
        playSongTime: {
          currentTime: 0,
          duration: 0,
          barMoveDistance: 0,
          songTimePlayed: "00:00",
          songTimeDuration: "00:00",
        },
        // 播放音量
        playVolume: 0.7,
        // 静音前音量
        playVolumeMute: 0,
        // 列表状态
        playlistState: 0, // 0 顺序 1 单曲循环 2 随机
        // 播放历史
        playHistory: [],
      },
    };
  },
  getters: {
    // 获取是否处于私人FM模式
    getPersonalFmMode(state) {
      return state.persistData.personalFmMode;
    },
    // 获取私人FM模式数据
    getPersonalFmData(state) {
      return state.persistData.personalFmData;
    },
    // 获取是否正在加载数据
    getLoadingState(state) {
      return state.isLoadingSong;
    },
    // 获取每日推荐
    getDailySongs(state) {
      return state.dailySongsData;
    },
    // 获取播放列表
    getPlaylists(state) {
      return state.persistData.playlists;
    },
    // 获取频谱数据
    getSpectrumsData(state) {
      return state.spectrumsData
    },
    // 获取播放模式
    getPlaySongMode(state) {
      return state.persistData.playSongMode;
    },
    // 获取当前歌曲
    getPlaySongData(state) {
      return state.persistData.playlists[state.persistData.playSongIndex];
    },
    // 获取当前歌词
    getPlaySongLyric(state) {
      return state.songLyric;
    },
    // 获取当前歌词索引
    getPlaySongLyricIndex(state) {
      return state.playSongLyricIndex;
    },
    // 获取当前播放时间
    getPlaySongTime(state) {
      return state.persistData.playSongTime;
    },
    // 获取播放状态
    getPlayState(state) {
      return state.playState;
    },
    // 获取喜欢音乐列表
    getLikeList(state) {
      return state.persistData.likeList;
    },
    // 获取播放历史
    getPlayHistory(state) {
      return state.persistData.playHistory;
    },
    // 获取播放列表模式
    getPlayListMode(state) {
      return state.persistData.playListMode;
    },
    // 获取搜索历史
    getSearchHistory(state) {
      return state.persistData.searchHistory;
    },
  },
  actions: {
    // 更改是否处于私人FM模式
    setPersonalFmMode(value) {
      this.persistData.personalFmMode = value;
      if (value) {
        if (typeof $player !== "undefined") soundStop($player);
        if (this.persistData.personalFmData?.id) {
          this.persistData.playlists = [];
          this.persistData.playlists.push(this.persistData.personalFmData);
          this.persistData.playSongIndex = 0;
        } else {
          this.setPersonalFmData();
        }
      }
    },
    // 当处于私人fm模式时更改歌单
    setPersonalFmData() {
      try {
        const songName = this.getPersonalFmData?.name;
        getPersonalFm().then((res) => {
          if (res.data[0]) {
            const data = res.data[2] || res.data[0];
            const fmData = {
              id: data.id,
              name: data.name,
              artist: data.artists,
              album: data.album,
              alia: data.alias,
              time: getSongTime(data.duration),
              fee: data.fee,
              pc: data.pc ? data.pc : null,
              mv: data.mvid,
            };
            if (songName && songName == fmData.name) {
              this.setFmDislike(fmData.id, false);
            } else {
              this.persistData.personalFmData = fmData;
              if (this.persistData.personalFmMode) {
                if (typeof $player !== "undefined") soundStop($player);
                this.persistData.playlists = [];
                this.persistData.playlists.push(fmData);
                this.persistData.playSongIndex = 0;
                this.setPlayState(true);
              }
            }
          } else {
            $message.error(getLanguageData("personalFmError"));
          }
        });
      } catch (err) {
        console.error(getLanguageData("personalFmError"), err);
        $message.error(getLanguageData("personalFmError"));
      }
    },
    // 私人fm垃圾桶
    setFmDislike(id) {
      const user = userStore();
      if (user.userLogin) {
        setFmTrash(id).then((res) => {
          if (res.code == 200) {
            this.persistData.personalFmMode = true;
            this.setPlaySongIndex("next");
          } else {
            $message.error(getLanguageData("fmTrashError"));
          }
        });
      } else {
        $message.error(getLanguageData("needLogin"));
      }
    },
    // 更改喜欢列表
    setLikeList() {
      const user = userStore();
      if (user.userLogin) {
        getLikelist(user.getUserData.id).then((res) => {
          this.persistData.likeList = res.ids;
        });
      }
    },
    // 查找歌曲是否处于喜欢列表
    getSongIsLike(id) {
      return this.persistData.likeList.includes(id);
    },
    // 移入移除喜欢列表
    async changeLikeList(id, like = true) {
      const user = userStore();
      const list = this.persistData.likeList;
      const exists = list.includes(id);
      if (!user.userLogin) {
        $message.error(getLanguageData("needLogin"));
        return;
      }
      try {
        const res = await setLikeSong(id, like);
        if (res.code === 200) {
          if (like && !exists) {
            list.push(id);
            $message.info(getLanguageData("loveSong"));
          } else if (!like && exists) {
            list.splice(list.indexOf(id), 1);
            $message.info(getLanguageData("loveSongRemove"));
          } else if (like && exists) {
            $message.info(getLanguageData("loveSongRepeat"));
          }
        } else {
          if (like) {
            $message.error(getLanguageData("loveSongError"));
          } else {
            $message.error(getLanguageData("loveSongRemoveError"));
          }
        }
      } catch (error) {
        console.error(getLanguageData("loveSongError"), error);
        $message.error(getLanguageData("loveSongError"));
      }
    },
    // 更改音乐播放状态
    setPlayState(value) {
      this.playState = value;
    },
    // 更改展示播放界面
    setBigPlayerState(value) {
      this.showBigPlayer = value;
    },
    // 更改播放条状态
    setPlayBarState(value) {
      this.showPlayBar = value;
    },
    // 更改播放列表模式
    setPlayListMode(value) {
      this.persistData.playListMode = value;
    },
    // 添加歌单至播放列表
    setPlaylists(value) {
      this.persistData.playlists = value.slice();
    },
    // 更改每日推荐数据
    setDailySongs(value) {
      if (value) {
        this.dailySongsData = [];
        value.forEach((v) => {
          this.dailySongsData.push({
            id: v.id,
            name: v.name,
            artist: v.ar,
            album: v.al,
            alia: v.alia,
            time: getSongTime(v.dt),
            fee: v.fee,
            pc: v.pc ? v.pc : null,
            mv: v.mv ? v.mv : null,
          });
        });
      }
    },
    // 歌词处理
    setPlaySongLyric(value) {
      if (value) {
        try {
          // 确保歌词数据中始终有lrc歌词数组
          if (!value.lrc || value.lrc.length === 0) {
            console.log("注意：歌词数据中缺少lrc数组，尝试从yrc创建");
            
            // 如果有yrc数据但没有lrc数据，尝试从yrc创建lrc
            if (value.yrc && value.yrc.length > 0) {
              value.lrc = value.yrc.map(yrcLine => ({
                time: yrcLine.time,
                content: yrcLine.TextContent
              }));
              console.log("已从yrc数据创建lrc数组");
            } else {
              // 如果没有yrc数据，创建占位符lrc
              value.lrc = [
                { time: 0, content: "暂无歌词" },
                { time: 999, content: "No Lyrics Available" }
              ];
              console.log("创建了占位符lrc数组");
            }
          }
          
          // 确保lrcAMData存在
          if (!value.lrcAMData || value.lrcAMData.length === 0) {
            if (value.yrcAMData && value.yrcAMData.length > 0) {
              // 如果有yrcAMData但没有lrcAMData，使用yrcAMData作为备用
              console.log("使用yrcAMData作为lrcAMData的备用");
              value.lrcAMData = [...value.yrcAMData];
            } else {
              // 创建基本的lrcAMData
              console.log("创建基本的lrcAMData数组");
              value.lrcAMData = value.lrc.map(line => ({
                startTime: line.time * 1000,
                endTime: (line.time + 5) * 1000, // 假设每行持续5秒
                words: [{
                  word: line.content,
                  startTime: line.time * 1000,
                  endTime: (line.time + 5) * 1000
                }],
                translatedLyric: "",
                romanLyric: "",
                isBG: false,
                isDuet: false
              }));
            }
          }
          
          // 确保TTML相关字段存在
          if (value.hasTTML === undefined) {
            value.hasTTML = false;
          }
          if (value.ttml === undefined) {
            value.ttml = [];
          }
          
          // 在存入状态前预处理歌词数据，提高性能
          console.time('预处理歌词');
          const settings = settingStore();
          try {
            // 预处理并缓存处理后的结果
            preprocessLyrics(value, {
              showYrc: settings.showYrc,
              showRoma: settings.showRoma,
              showTransl: settings.showTransl
            });
            console.log("歌词数据预处理完成");
          } catch (err) {
            console.warn("歌词预处理出错，将使用原始数据:", err);
          }
          console.timeEnd('预处理歌词');
          
          this.songLyric = value;
          console.log("歌词数据已存储到store:", this.songLyric);
        } catch (err) {
          $message.error(getLanguageData("getLrcError"));
          console.error(getLanguageData("getLrcError"), err);
          
          // 即使出错，也确保有基本的歌词结构
          this.songLyric = {
            lrc: [
              { time: 0, content: "加载歌词时出错" },
              { time: 999, content: "Error loading lyrics" }
            ],
            yrc: [],
            lrcAMData: [{
              startTime: 0,
              endTime: 5000,
              words: [{
                word: "加载歌词时出错",
                startTime: 0,
                endTime: 5000
              }],
              translatedLyric: "",
              romanLyric: "",
              isBG: false,
              isDuet: false
            }],
            yrcAMData: [],
            hasTTML: false,  // 出错时也设置TTML相关字段
            ttml: [],
            hasLrcTran: false,
            hasLrcRoma: false,
            hasYrc: false,
            hasYrcTran: false,
            hasYrcRoma: false,
            formattedLrc: ""
          };
        }
      } else {
        console.log("该歌曲暂无歌词");
        this.songLyric = {
          lrc: [],
          yrc: [],
          lrcAMData: [],
          yrcAMData: [],
          hasTTML: false,
          ttml: [],
          hasLrcTran: false,
          hasLrcRoma: false,
          hasYrc: false,
          hasYrcTran: false,
          hasYrcRoma: false,
          formattedLrc: ""
        };
      }
    },
    // 歌曲播放进度
    setPlaySongTime(value) {
      this.persistData.playSongTime.currentTime = value.currentTime;
      this.persistData.playSongTime.duration = value.duration;
      // 计算进度条应该移动的距离
      if (value.duration === 0) {
        this.persistData.playSongTime.barMoveDistance = 0;
      } else {
        this.persistData.playSongTime.barMoveDistance = Number(
          (value.currentTime / (value.duration / 100)).toFixed(2)
        );
      }

      if (!Number.isNaN(this.persistData.playSongTime.barMoveDistance)) {
        // 歌曲播放进度转换
        this.persistData.playSongTime.songTimePlayed = getSongPlayingTime(
          (value.duration / 100) * this.persistData.playSongTime.barMoveDistance
        );
        this.persistData.playSongTime.songTimeDuration = getSongPlayingTime(
          value.duration
        );
      }
      // 计算当前歌词播放索引
      const setting = settingStore();
      const lrcType = !this.songLyric.hasYrc || !setting.showYrc;
      const lyrics = lrcType ? this.songLyric.lrc : this.songLyric.yrc;
      const index = lyrics?.findIndex((v) => v?.time >= value?.currentTime);
      this.playSongLyricIndex = index === -1 ? lyrics.length - 1 : index - 1;
    },
    // 设置当前播放模式
    setPlaySongMode(value = null) {
      const modeObj = {
        normal: PlayCycle,
        random: ShuffleOne,
        single: PlayOnce,
      };
      if (value && value in modeObj) {
        this.persistData.playSongMode = value;
      } else {
        switch (this.persistData.playSongMode) {
          case "normal":
            this.persistData.playSongMode = "random";
            value = "random";
            break;
          case "random":
            this.persistData.playSongMode = "single";
            value = "single";
            break;
          default:
            this.persistData.playSongMode = "normal";
            value = "normal";
            break;
        }
      }
      $message.info(getLanguageData(value), {
        icon: () =>
          h(NIcon, null, {
            default: () => h(modeObj[this.persistData.playSongMode]),
          }),
      });
    },
    // 上下曲调整
    setPlaySongIndex(type) {
      // 如果 $player 未定义，返回 false
      if (typeof $player === "undefined") return false;
      // 停止播放当前歌曲
      soundStop($player)
      // 根据播放模式设置加载状态
      if (this.persistData.playSongMode !== "single") {
        this.isLoadingSong = true;
      }
      // 如果是个人 FM 模式，设置个人 FM 数据
      if (this.persistData.personalFmMode) {
        this.setPersonalFmData();
      } else {
        const listLength = this.persistData.playlists.length;
        const listMode = this.persistData.playSongMode;
        // 根据当前播放模式调整播放索引
        if (listMode === "normal") {
          this.persistData.playSongIndex += type === "next" ? 1 : -1;
        } else if (listMode === "random") {
          this.persistData.playSongIndex = Math.floor(
            Math.random() * listLength
          );
        } else if (listMode === "single") {
          // 单曲循环模式
          console.log("单曲循环模式");
          fadePlayOrPause($player, "play", this.persistData.playVolume);
        } else {
          // 未知播放模式，显示错误消息
          $message.error(getLanguageData("playError"));
        }
        // 检查播放索引是否越界，并根据情况进行处理
        if (listMode !== "single") {
          if (this.persistData.playSongIndex < 0) {
            this.persistData.playSongIndex = listLength - 1;
          } else if (this.persistData.playSongIndex >= listLength) {
            this.persistData.playSongIndex = 0;
            soundStop($player);
            fadePlayOrPause($player, "play", this.persistData.playVolume);
          }
          // 如果播放列表长度大于 1，则停止播放当前歌曲
          if (listLength > 1) {
            soundStop($player);
          }
          // 在下一个事件循环中设置播放状态
          nextTick().then(() => {
            this.setPlayState(true);
          });
        }
      }
    },
    // 添加歌曲至播放列表
    addSongToPlaylists(value, play = true) {
      // 停止当前播放
      if (typeof $player !== "undefined") soundStop($player);
      // 判断与上一次播放歌曲是否一致
      const index = this.persistData.playlists.findIndex(
        (o) => o.id === value.id
      );
      try {
        if (
          value.id !==
          this.persistData.playlists[this.persistData.playSongIndex]?.id
        ) {
          console.log("Play a song that is not the same as the last one");
          if (typeof $player !== "undefined") soundStop($player);
          this.isLoadingSong = true;
        }
      } catch (error) {
        console.error("Error:" + error);
      }
      if (index !== -1) {
        this.persistData.playSongIndex = index;
      } else {
        this.persistData.playlists.push(value);
        this.persistData.playSongIndex = this.persistData.playlists.length - 1;
      }
      play ? this.setPlayState(true) : null;
    },
    // 在当前播放歌曲后添加
    addSongToNext(value) {
      // 更改播放模式为列表循环
      this.persistData.playSongMode = "normal";
      // 查找是否存在于播放列表
      const index = this.persistData.playlists.findIndex(
        (o) => o.id === value.id
      );
      if (index !== -1) {
        console.log(index);
        if (index === this.persistData.playSongIndex) return true;
        if (index < this.persistData.playSongIndex)
          this.persistData.playSongIndex--;
        const arr = this.persistData.playlists.splice(index, 1)[0];
        this.persistData.playlists.splice(
          this.persistData.playSongIndex + 1,
          0,
          arr
        );
      } else {
        this.persistData.playlists.splice(
          this.persistData.playSongIndex + 1,
          0,
          value
        );
      }
      $message.success(value.name + " " + getLanguageData("addSongToNext"));
    },
    // 播放列表移除歌曲
    removeSong(index) {
      if (typeof $player === "undefined") return false;
      const name = this.persistData.playlists[index].name;
      if (index < this.persistData.playSongIndex) {
        this.persistData.playSongIndex--;
      } else if (index === this.persistData.playSongIndex) {
        // 如果删除的是当前播放歌曲，则重置播放器
        soundStop($player);
      }
      $message.success(name + " " + getLanguageData("removeSong"));
      this.persistData.playlists.splice(index, 1);
      // 检查当前播放歌曲的索引是否超出了列表范围
      if (this.persistData.playSongIndex >= this.persistData.playlists.length) {
        this.persistData.playSongIndex = 0;
        soundStop($player);
      }
    },
    // 获取歌单分类
    setCatList(highquality = false) {
      getPlayListCatlist().then((res) => {
        if (res.code == 200) {
          this.catList = res;
        } else {
          $message.error(getLanguageData("getDataError"));
        }
      });
      if (highquality) {
        getPlayListCatlist(true).then((res) => {
          if (res.code == 200) {
            this.highqualityCatList = res.tags;
          } else {
            $message.error(getLanguageData("getDataError"));
          }
        });
      }
    },
    // 更改播放历史
    setPlayHistory(data, clean = false) {
      if (clean) {
        this.persistData.playHistory = [];
      } else {
        const index = this.persistData.playHistory.findIndex(
          (item) => item.id === data.id
        );
        if (index !== -1) {
          this.persistData.playHistory.splice(index, 1);
          // return false;
        }
        if (this.persistData.playHistory.length > 100)
          this.persistData.playHistory.pop();
        this.persistData.playHistory.unshift(data);
      }
    },
    // 更改搜索历史
    setSearchHistory(name, clean = false) {
      if (clean) {
        this.persistData.searchHistory = [];
      } else {
        const index = this.persistData.searchHistory.indexOf(name);
        if (index !== -1) {
          this.persistData.searchHistory.splice(index, 1);
        }
        this.persistData.searchHistory.unshift(name);
        if (this.persistData.searchHistory.length > 30) {
          this.persistData.searchHistory.pop();
        }
      }
    },
    // 更新当前播放时间
    updateCurrentTime(time) {
      this.currentTime = Math.floor(time * 1000); // 转换为毫秒
    },
    // 设置加载状态
    setLoadingState(state) {
      this.isLoadingSong = state;
    },
    // 设置播放状态
    setPlayState(state) {
      this.playState = state;
    },
  },
  // 开启数据持久化
  persist: [
    {
      storage: localStorage,
      paths: ["persistData"],
    },
  ],
});

export default useMusicDataStore;
