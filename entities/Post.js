import PostModel from "../models/PostModel.js";
import InterfacePost from './interfaces/interfacePost.js'

class Post extends InterfacePost {
  title;
  content;
  creation_date;
  modification_date;
  files_list;
  published;
  region;
  tribe;

  constructor() {
    super()

    this.dataManager = new PostModel();
  }

  /**
   * @returns string
   */
   get getTitle() {
    return this.title;
  }

  /**
   * @returns string
   */
  get getContent() {
    return this.content;
  }

  /**
   * @returns number
   */
  get getCreationDate() {
    return this.creation_date;
  }

  /**
   * @returns number
   */
  get getModificationDate() {
    return this.modification_date;
  }

  /**
   * @returns array of strings
   */
  get getFilesList() {
    return this.files_list;
  }

  /**
   * @returns boolean
   */
  get getPublished() {
    return this.published;
  }

  /**
   * @returns string
   */
  get getRegion() {
    return this.region;
  }

  /**
   * @returns String
   */
  get getTribe() {
    return this.tribe;
  }

  /**
   * This method allow the subscriber to propose a post
   * @param {any} datas
   * @param {string} userId
   */
  async proposePost(datas, userId) {
    const { data, error } = await this.dataManager.createPost(
      datas.title,
      datas.content,
      datas.files_list,
      false,
      datas.region,
      datas.tribe,
      userId
    );

    return { data, error };
  }

  /**
   * This method allow a user to like a post
   * @param {string} idPost
   * @param {string} idUser
   */
  async likePost(idPost, idUser) {
    const { data, error } = await this.dataManager.likePost(idPost, idUser);

    return { data, error };
  }

  /**
   * This method allows the user - expert to publish a post
   * @param {any} datas
   */
  async publishPost(datas, userId) {
    const { data, error } = await this.dataManager.createPost(
      datas.title,
      datas.content,
      datas.files_list,
      true,
      datas.region,
      datas.tribe,
      userId
    );

    console.log(datas)

    return { data, error };
  }

  /**
   * This method allow a user - expert to validate a post
   * @param {string} idPost
   * */
  async validatePost(idPost, idUser) {
    const { data, error } = await this.dataManager.updatePostValidation(idPost, idUser, true);

    return { data, error };
  }
}

export default Post;
