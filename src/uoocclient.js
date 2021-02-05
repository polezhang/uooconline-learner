/*
 * @Author: Jindai Kirin 
 * @Date: 2018-11-02 20:55:42 
 * @Last Modified by: polezhang
 * @Last Modified time: 2020-11-10 11:01:17
 */

const getDuration = require('get-video-duration');
const UoocAPI = require('./uoocapi');
const srt2txt = require('./srt2txt');
const Fs = require('fs');

const VIDEO_MODE = 10;

function clog(str) {
	process.stdout.write(str);
}

function clogln(str = '') {
	console.log(str);
}

function sleep(s) {
	return new Promise(resolve => setTimeout(resolve, s * 1000));
}

class UoocClient {
	constructor(cookie) {
		this.API = new UoocAPI(cookie);
	}

	async downloadSubtitles(cid) {
		const API = this.API;

		let list;

		clog("获取课程视频列表");
		await API.getCatalogList(cid).then(ret => {
			if (ret.code != 1) throw new Error(ret.msg);
			list = ret.data;
		});
		clogln(" √");

		//章节
		for (let chapter of list) {
			let saveFile = `./subtitles/${cid}-${chapter.number}.txt`;
			if (Fs.existsSync(saveFile)) continue;

			Fs.writeFileSync(saveFile, chapter.name + '\n\n', {
				'flag': 'a'
			});

			//小节
			for (let section of chapter.children) {
				//资源点
				let resources;
				await API.getUnitLearn(cid, chapter.id, section.id).then(ret => {
					if (ret.code != 1) {
						Fs.unlinkSync(saveFile);
						throw new Error(ret.msg);
					}
					resources = ret.data;
				});

				for (let resource of resources) {
					if (resource.type != VIDEO_MODE) continue;

					//字幕
					let subtitle, txt;
					for (let key in resource.subtitle) {
						let pass = true;
						subtitle = resource.subtitle[key][0];
						await srt2txt(subtitle.uri).then(ret => txt = ret).catch(() => pass = false);
						if (pass) {
							clogln('[' + key + '] ' + subtitle.title);
							break;
						}
					}

					Fs.writeFileSync(saveFile, subtitle.title + '\n\n' + txt + '\n\n', {
						'flag': 'a'
					});
				}
			}
		}
	}

	async learn(cid, speed) {
		const API = this.API;

		let list;
		speed *= 0.97;

		clog("获取课程视频列表");
		await API.getCatalogList(cid).then(ret => {
			if (ret.code != 1) throw new Error(ret.msg);
			list = ret.data;
		});
		clogln(" √");

		//章节
		for (let chapter of list) {
			clog('\n' + chapter.name.replace(/^ +/, ''));
			if (chapter.finished ) { // || chapter.learn_mode != VIDEO_MODE    || chapter.learn_mode != 20
				clogln(" √");
				continue;
			}
			clogln();

			//小节
			for (let section of chapter.children) {
				// console.log(section);
				// clog(section.number + ' ' + section.name.replace(/^ +/, ''));
				clog(section.name.replace(/^ +/, ''));
				clogln();

			if (!section.finished || section.learn_mode != VIDEO_MODE) { // level 2级需要学习的内容
				//资源点
				let resources;
				await API.getUnitLearn(cid, chapter.id, section.id).then(ret => {
					if (ret.code != 1) throw new Error(ret.msg);
					resources = ret.data;
				});

				for (let resource of resources) {
				  if(resource.title){
				  	clog('\t' + resource.title.replace(/^ +/, ''));
					}
					if (resource.finished || !resource.is_task || resource.type != VIDEO_MODE) {
						clogln(" √");
						continue;
					}
					clogln();

					//资源信息
					let video_length;
					for (let key in resource.video_url) {
						let pass = true;
						let video_url = encodeURI(resource.video_url[key].source);
						await getDuration(video_url).then(duration => video_length = duration.toFixed(2)).catch(() => pass = false);
						if (pass) break;
					}
					let video_pos = parseFloat(resource.video_pos); //video_pos is a "number"
					let vmax = parseFloat(video_length);

					//模拟学习进度
					let finished = false;
					while (true) {
						clogln('\t' + video_pos.toFixed(2) + '/' + video_length);

						await API.markVideoLearn(cid, chapter.id, section.id, resource.id, video_length, video_pos.toFixed(2)).then(ret => {
							if (ret.code != 1) throw new Error(ret.msg);
							finished = ret.data.finished;
						});

						if (finished) break;
						video_pos += 60 * speed + Math.random();

						let reduce = 0;
						if (video_pos > vmax) {
							reduce = (video_pos - vmax) / speed;
							video_pos = vmax;
						}

						await sleep(65 - reduce);
					}
				}
			}
				if(section.children){ // 若有子节点
					let subsection_content;// level 3级子节点内容

					for (let subsection of section.children) {
						subsection_content = subsection;
						clog(subsection.name.replace(/^ +/, ''));

						if (subsection.finished || subsection.learn_mode != 20) {
							clogln(" √");
							continue;
						}
						clogln();

						//资源点
						let resources;
						await API.getUnitLearnSub(cid, chapter.id, section.id,subsection.id).then(ret => {
							if (ret.code != 1) throw new Error(ret.msg);
							resources = ret.data;
							// console.log("resources")
							// console.log(resources)

						});

						for (let resource of resources) {
							if(resource.title){
								clog('\t' + resource.title.replace(/^ +/, ''));
							}
							if (resource.finished || !resource.is_task || resource.type != VIDEO_MODE) {
								clogln(" √");
								// console.log("333")
								continue;
							}
							clogln();

							//资源信息
							let video_length;
							for (let key in resource.video_url) {
								// console.log("44")
								let pass = true;
								let video_url = encodeURI(resource.video_url[key].source);
								await getDuration(video_url).then(duration => video_length = duration.toFixed(2)).catch(() => pass = false);
								if (pass) break;
							}
							let video_pos = parseFloat(resource.video_pos); //video_pos is a "number"
							let vmax = parseFloat(video_length);

							//模拟学习进度
							let finished = false;
							while (true) {
								clogln('\t' + video_pos.toFixed(2) + '/' + video_length);
								console.log("55")
								await API.markVideoLearnSub(cid, chapter.id, section.id,subsection_content.id, resource.id, video_length, video_pos.toFixed(2)).then(ret => {
									if (ret.code != 1) throw new Error(ret.msg);
									finished = ret.data.finished;
								});

								if (finished) break;
								video_pos += 60 * speed + Math.random();

								let reduce = 0;
								if (video_pos > vmax) {
									reduce = (video_pos - vmax) / speed;
									video_pos = vmax;
								}
								// console.log("66")

								await sleep(65 - reduce);
							}
						}
					}
					
				}




				console.log("end")


			}
		}
	}
}


module.exports = UoocClient;
