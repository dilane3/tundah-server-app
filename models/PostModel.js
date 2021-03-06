import { config } from "dotenv";
import { nanoid } from "nanoid";
import dbConnect from "../utils/database.js";
import jwt from "jsonwebtoken";
import InterfacePostModel from "./interfaces/interfacePostModel.js";
import { error, session } from "neo4j-driver";

// fetching data from .env file
config();

const { SECRET_CODE_TOKEN } = process.env;

class PostModel extends InterfacePostModel {
  /**
   * This function get a specific user based on his id
   * @param {string} id
   */
  async getPost(id) {
    const session = dbConnect();

    try {
      const query = `
        MATCH (post:Post {id: $id})
        RETURN post
      `;
      const result = await session.run(query, { id });
      console.log({ id });

      if (result.records.length > 0) {
        const postData = result.records[0].get("post").properties;

        if (postData.published) {
          const { commentsNumber } = await this.getCommentNumber(postData.id);
          const { likes } = await this.getLikes(postData.id);

          return { data: { ...postData, comments: commentsNumber, likes } };
        }

        return { data: postData };
      } else {
        return { data: null };
      }
    } catch (err) {
      return { error: "Error while getting a post" };
    } finally {
      await session.close();
    }
  }

  /**
   * This function return the researched posts using it's title
   * Independent of the substring position
   * And is case insensitive
   * @param {string} value
   * @returns post(s)
   */
  async getSearchedPosts(value) {
    const session = dbConnect();

    try {
      const query = `
        MATCH (post:Post{published: ${true}})
        WHERE post.title =~ '(?i).*(${value.toLowerCase()}).*'
        RETURN post
        ORDER BY post.creation_date DESC
        `;

      const result = await session.run(query);
      console.log(result.records);

      const moreInfosData = await this.gettingMoreInfos(result, "post");

      if (moreInfosData.length > 0) {
        return { data: moreInfosData };
      } else {
        return { data: [] };
      }
    } catch (err) {
      console.log(err);
      return { error: "Sorry the post(s) has not been found" };
    } finally {
      session.close();
    }
  }

  /**
   * This function returns the number of posts available in the database
   */
  async getNumberPost(session, status) {
    try {
      const query = `
        MATCH (posts:Post{published: ${status}})
        RETURN posts
      `;

      const result = await session.run(query);

      return { postNumber: result.records.length };
    } catch (err) {
      console.log(err);
      return { error: "Error occured while getting posts number" };
    }
  }

  /**
   * This function return the number of comment linked to a specific post
   * @param {Session} session
   * @param {string} id
   */
  async getCommentNumber(id) {
    const session = dbConnect();

    try {
      const query = `
        MATCH (post:Post{id: $id}) -[commentsNumber:HAS_COMMENT]-> (:Comment)
        RETURN commentsNumber
      `;

      const result = await session.run(query, { id });

      return { commentsNumber: result.records.length };
    } catch (err) {
      return {
        error:
          "Error occured while getting comment number linked to a specific post",
      };
    } finally {
      await session.close();
    }
  }

  /**
   * This function return the number of comment linked to a specific post
   * @param {Session} session
   * @param {string} id
   */
  async getLikes(id) {
    const session = dbConnect();

    try {
      const query = `
        MATCH (posts:Post{id: $id}) -[numberLike:LIKED_BY]-> (users:Subscriber)
        RETURN users
      `;

      const result = await session.run(query, { id });

      const usersId = result.records.map((record) => {
        return record.get("users").properties?.id;
      });

      return { likes: usersId };
    } catch (err) {
      console.log(err);
      return {
        error:
          "Error occured while getting number of like linked to a specific post",
      };
    } finally {
      await session.close();
    }
  }

  async getAuthorOfPost(id) {
    const session = dbConnect();

    try {
      let editors = [];
      let author = null;

      // query for retrieving the user who has proposed the post
      const query1 = `
        MATCH (:Post{id: $id}) -[proposed_by:PROPOSED_BY]-> (user:Subscriber)
        RETURN proposed_by, user
        LIMIT 1
      `;
      const result1 = await session.run(query1, { id });

      if (result1.records.length > 0) {
        // getting author who has proposed the post
        author = result1.records[0].get("user").properties;

        // query for retrieving all the experts who have edited the post
        const query3 = `
          MATCH (post:Post{id: $id}) -[:EDITED_BY]-> (users:Expert)
          RETURN users
        `;
        const result3 = await session.run(query3, { id });

        if (result3.records.length > 0) {
          // getting editors
          for (let expert of result3.records) {
            const editor = expert.get("users").properties;
            editors.push(editor);
          }
        }

        const query4 = `
          MATCH (:Post{id: $id}) -[:PUBLISHED_BY]-> (user:Expert)
          RETURN user
          LIMIT 1
        `;
        const result4 = await session.run(query4, { id });

        if (result4.records.length > 0) {
          const editor = result4.records[0].get("user").properties;
          editors.push(editor);
        }
      } else {
        const query2 = `
          MATCH (:Post{id: $id}) -[:PUBLISHED_BY]-> (user:Expert)
          RETURN user
          LIMIT 1
        `;
        const result2 = await session.run(query2, { id });

        if (result2.records.length > 0) {
          // getting author who has published the post
          author = result2.records[0].get("user").properties;
        }

        // query for retrieving all the experts who have edited the post
        const query4 = `
          MATCH (:Post{id: $id}) -[:EDITED_BY]-> (users:Expert)
          RETURN users
        `;
        const result4 = await session.run(query4, { id });

        if (result4.records.length > 0) {
          // getting editors
          for (let expert of result4.records) {
            const editor = expert.get("users").properties;
            editors.push({ ...editor });
          }
        }
      }

      return { editors, author };
    } catch (err) {
      return { editors: [], author: null };
    } finally {
      await session.close();
    }
  }

  async gettingMoreInfos(result, field) {
    let postData = [];

    for (let record of result.records) {
      const post = record.get(field).properties;

      const { commentsNumber } = await this.getCommentNumber(post.id);
      const { likes } = await this.getLikes(post.id);
      const { editors, author } = await this.getAuthorOfPost(post.id);

      postData.push({
        ...post,
        likes,
        comments: commentsNumber,
        author,
        subAuthors: editors,
      });
    }

    return postData;
  }

  /**
   * This method retrieves all the avalaible posts
   */
  async getAllPosts(skip, limit, status) {
    const session = dbConnect();

    try {
      const { postNumber, error } = await this.getNumberPost(session, status);

      if (postNumber !== undefined) {
        const query = `
          MATCH (posts:Post{published: ${status}})
          RETURN posts
          ORDER BY posts.creation_date DESC
          SKIP ${skip}
          LIMIT ${limit}
        `;

        const result = await session.run(query);

        const postData = await this.gettingMoreInfos(result, "posts");

        if (postNumber > Number(skip) + Number(limit)) {
          return {
            data: {
              data: postData,
              next: true,
              skip: Number(skip) + Number(limit),
            },
          };
        } else {
          return { data: { data: postData, next: false, skip: Number(skip) } };
        }
      } else {
        return { error };
      }
    } catch (err) {
      console.log(err);
      return { error: "Error while getting the posts" };
    } finally {
      await session.close();
    }
  }

  /**
   * This method returns post which are linked to a specific user
   * @param {string} idUser
   * @returns
   */
  async getMyPosts(idUser) {
    const session = dbConnect();

    try {
      const query1 = `
        MATCH (publishedPost:Post) -[:PUBLISHED_BY]-> (user:Expert{id: $idUser})
        RETURN publishedPost
      `;
      const query2 = `
        MATCH (proposedPost:Post) -[:PROPOSED_BY]-> (user:Subscriber{id: $idUser})
        RETURN proposedPost
      `;
      const result1 = await session.run(query1, { idUser });
      const result2 = await session.run(query2, { idUser });

      const publishedPost = await this.gettingMoreInfos(
        result1,
        "publishedPost"
      );

      let proposedPost = await this.gettingMoreInfos(result2, "proposedPost");

      // let proposedPost = result2.records.map((record) => {
      //   return record.get("proposedPost").properties;
      // });

      const postData = [...publishedPost, ...proposedPost];

      return { data: postData };
    } catch (err) {
      return { error: "Error while getting the posts" };
    } finally {
      await session.close();
    }
  }

  /**
   * This method create a new post
   * @param {string} title
   * @param {string} content
   * @param {Array} files_list
   * @param {boolean} published
   * @param {string} region
   * @param {string} tribe
   * @param {string} idUser
   */
  async createPost(
    title,
    content,
    files_list,
    published,
    region,
    tribe,
    idUser
  ) {
    const session = dbConnect();

    try {
      const query = `
        MATCH (user${published ? ":Expert" : ":Subscriber"} {id: $idUser})
        CREATE 
        (post:Post 
          { 
            id: $id,
            title: $title,
            content: $content, 
            creation_date: $creation_date,
            modification_date: $modification_date, 
            files_list: $files_list, 
            published: $published, 
            region: $region,
            tribe: $tribe
          }
        ) - [${published ? ":PUBLISHED_BY" : ":PROPOSED_BY"}] -> (user)
        CREATE (user) - [${published ? ":PUBLISHED" : ":PROPOSED"}] -> (post)
        RETURN post
      `;

      const result = await session.run(query, {
        id: nanoid(20),
        title: title.toLowerCase(),
        content,
        creation_date: Date.now(),
        modification_date: Date.now(),
        files_list,
        published,
        region,
        tribe,
        idUser,
      });

      if (result.records.length > 0) {
        const postData = await this.gettingMoreInfos(result, "post");

        return { data: postData[0] };
      } else {
        return { data: null };
      }
    } catch (err) {
      console.log(err);
      return { error: "Error while creating the post" };
    } finally {
      await session.close();
    }
  }

  /**
   * This function deletes a post based on it's id's
   * @param {string} idPost
   * @param {string} idUser
   */
  async deletePost(idPost, idUser, role) {
    const session = dbConnect();

    try {
      let query = "";

      if (role) {
        query = `
          MATCH (post:Post{id: $idPost}) -[:PUBLISHED_BY]-> (user:Expert{id: $idUser})
          DETACH DELETE post
        `;
      } else {
        query = `
          MATCH (post:Post{id: $idPost}) -[:PROPOSED_BY]-> (user:Subscriber{id: $idUser})
          WHERE post.published = ${false}
          DETACH DELETE post
        `;
      }

      await session.run(query, { idPost, idUser });

      return { data: "The post has successfully been deleted" };
    } catch (err) {
      console.log(err);
      return { error: "The post has not been found" };
    } finally {
      await session.close();
    }
  }

  /**
   * This function updates a post based on it's id and the form data
   * @param {string} idPost
   * @param {string} title
   * @param {string} content
   * @param {Array} files_list
   * @param {boolean} published
   * @param {string} region
   * @param {string} tribe
   * @param {string} idUser
   */
  async updatePost(idPost, title, content, files_list, region, tribe, idUser) {
    const session = dbConnect();

    try {
      const query = `
      MATCH 
        (post:Post {id: $idPost}),
        (user:Expert {id: $idUser})
      SET
        post.title = $title,
        post.content = $content, 
        post.modification_date = $modification_date, 
        post.files_list = $files_list,
        post.region = $region,
        post.tribe = $tribe
      MERGE (user) -[:EDITED]-> (post)
      MERGE (post) -[:EDITED_BY]-> (user)
      RETURN post
    `;
      const response = await session.run(query, {
        idPost,
        idUser,
        title: title.toLowerCase(),
        content,
        modification_date: Date.now(),
        files_list,
        region,
        tribe,
      });

      if (response.records.length > 0) {
        const postData = response.records[0].get("post").properties;

        return { data: postData };
      } else {
        return { data: null };
      }
    } catch (err) {
      return { error: "The post has not been found" };
    } finally {
      await session.close();
    }
  }

  /**
   * This function updates a post based on it's id and the form data
   * @param {string} idPost
   * @param {string} idUser
   * @param {boolean} published
   */
  async updatePostValidation(idPost, idUser, published) {
    const session = dbConnect();

    try {
      const query = `
      MATCH 
        (post:Post {id: $idPost}),
        (user:Expert {id: $idUser})
      SET
        post.published = $published,
        post.modification_date = $modification_date
      MERGE (post) -[:PUBLISHED_BY]-> (user)
      MERGE (user) -[:PUBLISHED]-> (post)
      RETURN post
    `;
      const response = await session.run(query, {
        idPost,
        idUser,
        published,
        modification_date: Date.now(),
      });

      if (response.records.length > 0) {
        const postData = response.records[0].get("post").properties;

        return { data: postData };
      } else {
        return { data: null };
      }
    } catch (err) {
      console.log(err);
      return { error: "The post doesn't exist anymore!!" };
    } finally {
      await session.close();
    }
  }

  async hasBeenLiked(idPost, idUser, session) {
    try {
      const query = `
        MATCH (post:Post {id: $idPost}) -[likedBy:LIKED_BY]-> (user:Subscriber {id: $idUser})
        RETURN likedBy
      `;

      const result = await session.run(query, { idPost, idUser });

      if (result.records.length > 0) {
        return true;
      } else {
        return false;
      }
    } catch (err) {
      return {
        error:
          "Error occurs while testing if a post has been already liked or not",
      };
    }
  }

  /**
   * This method permits to a Subscriber to like a post
   * @param {string} idPost
   * @param {string} idUser
   */
  async likePost(idPost, idUser) {
    const session = dbConnect();

    try {
      let query;

      if (await this.hasBeenLiked(idPost, idUser, session)) {
        query = `
          MATCH (post:Post {id: $idPost}), (user:Subscriber {id: $idUser})
          MATCH (post) - [publishedPostLike:LIKED_BY] -> (user)
          MATCH (user) - [like:LIKED] -> (post)
          DELETE publishedPostLike, like
        `;

        await session.run(query, { idPost, idUser });

        return { data: "Post has succesfully been unliked" };
      } else {
        query = `
          MATCH (post:Post {id: $idPost}), (user:Subscriber {id: $idUser})
          CREATE (post) - [publishedPostLike:LIKED_BY] -> (user)
          CREATE (user) - [like:LIKED] -> (post)
          RETURN publishedPostLike
        `;

        const result = await session.run(query, { idPost, idUser });

        if (result.records.length > 0) {
          return { data: "Post has succesfully been liked" };
        } else {
          return { data: null };
        }
      }
    } catch (err) {
      return { error: "The post doesn't exist anymore" };
    } finally {
      session.close();
    }
  }
}

export default PostModel;
