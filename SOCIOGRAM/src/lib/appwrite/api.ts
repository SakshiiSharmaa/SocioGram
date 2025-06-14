import { type INewPost, type INewUser, type IUpdatePost } from "../../types";
import { ID } from "appwrite";
import { account, appwriteConfig, avatars, databases, storage } from "./config";
import { Query } from "appwrite"
import type { PageParam } from "@/constants";
export async function createUserAccount(user: INewUser) {
  try {
    const newAccount = await account.create(
      ID.unique(),
      user.email,
      user.password,
      user.name
    )

    if (!newAccount) throw Error;

    const avatarUrl = avatars.getInitials(user.name);

    const newUser = await saveUserToDB({
      accountId: newAccount.$id,
      name: newAccount.name,
      email: newAccount.email,
      username: user.username,
      imageUrl: new URL(avatarUrl),
    });

    return newUser;
  } catch (error) {
    console.log(error)
    return error
  }

}

export async function saveUserToDB(user: {
  accountId: string;
  email: string;
  name: string;
  imageUrl: URL;
  username: string;
}) {
  try {
    const newUser = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      ID.unique(),
      user,
    )
    return newUser;
  } catch (error) {
    console.log(error);
  }

}

export async function signInAccount(user: { email: string; password: string }) {
  try {
    const isSessionExist = await account.get();
    // NOTE: Only one session is allowed at a time
    if (isSessionExist) {
      await account.deleteSession('current');
    }
  } catch (error) {
    console.log(error)
  }
  try {
    const session = await account.createEmailPasswordSession(user.email, user.password);
    return session;
  } catch (error) {
    console.log(error)
  }
}

export async function getCurrentUser() {
  try {
    const currentAccount = await account.get();

    if (!currentAccount) throw Error;

    const currentUser = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal('accountId', currentAccount.$id)]
    )

    if (!currentAccount) throw Error;

    return currentUser.documents[0];

  } catch (error) {
    console.log(error)
  }
}

export async function signOutAccount() {
  try {
    const session = await account.deleteSession("current");
    return session;
  } catch (error) {
    console.log(error)
  }
}

export async function createPost(post: INewPost) {
  try {
    // Upload file to appwrite storage
    const uploadedFile = await uploadFile(post.file[0]);

    if (!uploadedFile) throw Error;

    // Get file url
    const fileUrl = getFilePreview(uploadedFile.$id);
    if (!fileUrl) {
      await deleteFile(uploadedFile.$id);
      throw Error;
    }
    // Convert tags into array
    const tags = post.tags?.replace(/ /g, "").split(",") || [];

    // Create post
    const newPost = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      ID.unique(),
      {
        creator: post.userId,
        caption: post.caption,
        imageUrl: fileUrl,
        imageId: uploadedFile.$id,
        location: post.location,
        tags: tags,
      }
    );
    if (!newPost) {
      await deleteFile(uploadedFile.$id);
      throw Error;
    }

    return newPost;
  } catch (error) {
    console.log(error);
  }
}

// ============================== UPLOAD FILE
export async function uploadFile(file: File) {
  try {
    const uploadedFile = await storage.createFile(
      appwriteConfig.storageId,
      ID.unique(),
      file
    );

    return uploadedFile;
  } catch (error) {
    console.log(error);
  }
}

// ============================== GET FILE URL
export function getFilePreview(fileId: string) {
  try {
    const fileUrl = storage.getFileView(appwriteConfig.storageId, fileId);

    // const fileUrl = storage.getFileView(
    //   appwriteConfig.storageId,
    //   fileId,
    //   2000,
    //   2000,
    //   ImageGravity.Top,
    //   100
    // );

    if (!fileUrl) throw Error;

    return fileUrl;
  } catch (error) {
    console.log(error);
  }
}

// ============================== DELETE FILE
export async function deleteFile(fileId: string) {
  try {
    await storage.deleteFile(appwriteConfig.storageId, fileId);

    return { status: "ok" };
  } catch (error) {
    console.log(error);
  }
}

export async function getRecentPosts() {
  const posts = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.postCollectionId,
    [Query.orderDesc('$createdAt'), Query.limit(20)]
  )
  if (!posts) throw Error
  return posts;
}

export async function LikePost(postId: string, likesArray: string[]) {
  try {
    const updatedPost = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId,
      {
        likes: likesArray
      }
    )
    if (!updatedPost) throw Error;

    return updatedPost;
  } catch (error) {
    console.log(error);
  }
}

export async function SavePost(postId: string, userId: string) {
  try {
    const currentAccount = await account.get();
    const updatedPost = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.savesCollectionId,
      ID.unique(),
      {
        accountId: currentAccount.$id,
        user: [userId],
        post: postId
      }
    )

    if (!updatedPost) throw Error;

    return updatedPost;
  } catch (error) {
    console.log(error);
  }
}

export async function DeleteSavedPost(savedRecordId: string) {
  try {
    const statusCode = await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.savesCollectionId,
      savedRecordId
    )

    if (!statusCode) throw Error;

    return statusCode;
  } catch (error) {
    console.log(error);
  }
}

export async function getPostByID(postId: string) {
  try {

    const post = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId
    )

    return post;

  } catch (error) {
    console.log(error);
  }
}

export async function updatePost(post: IUpdatePost) {
  const hasFileToUpdate = post.file.length > 0;

  try {
    let image = {
      imageUrl: post.imageUrl || ' ',
      imageId: post.imageId
    }

    if (hasFileToUpdate) {
      // Upload file to appwrite storage
      const uploadedFile = await uploadFile(post.file[0]);

      if (!uploadedFile) throw Error;

      // Get file url
      const fileUrl = getFilePreview(uploadedFile.$id);

      if (!fileUrl) {
        await deleteFile(uploadedFile.$id);
        throw Error;
      }

      image = { ...image, imageUrl: new URL(fileUrl), imageId: uploadedFile.$id }
    }

    // Convert tags into array
    const tags = post.tags?.replace(/ /g, "").split(",") || [];

    // Create post
    const updatedPost = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      post.postId,
      {
        caption: post.caption,
        imageUrl: image.imageUrl,
        imageId: image.imageId,
        location: post.location,
        tags: tags,
      }
    );
    if (!updatedPost) {
      await deleteFile(post.imageId);
      throw Error;
    }

    return updatedPost;
  } catch (error) {
    console.log(error);
  }
}

export async function deletePost(postId: string, imageId: string) {
  if (!postId || !imageId) throw Error;

  try {
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId
    )

    return { status: 'ok' };
  } catch (error) {
    console.log(error);
  }
}


export async function getInfinitePosts({ direction = 'next', cursor = '' }: PageParam) {
  const queries = [Query.orderDesc('$updatedAt'), Query.limit(6)]

  if (cursor) {
    if (direction === 'next') {
      queries.push(Query.cursorAfter(cursor));
    } else if (direction === 'prev') {
      queries.push(Query.cursorBefore(cursor));
    }
  }

  try {
    const posts = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      queries
    )
    if (!posts) throw Error
    return posts
  } catch (error) {
    console.log(error);
  }
}

export async function searchPosts(searchTerm: string) {
  try {
    const posts = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      [Query.contains('caption', searchTerm)]
    )
    if (!posts) throw Error
    return posts
  } catch (error) {
    console.log(error);
  }
}

export async function getSavedPost() {
  try {
    const currentAccount = await account.get();
    if (!currentAccount) throw Error;

    const savedPosts = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.savesCollectionId,
      [Query.equal('accountId', currentAccount.$id)]
    )
    return savedPosts;

  } catch (error) {
    console.log(error);
  }
}

export async function getAllUsers() {
  try {
    const currentAccount = await account.get();
    if (!currentAccount) throw Error;

    const allUsers = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.notEqual('accountId', currentAccount.$id)]
    )
    return allUsers;
  } catch (error) {
    console.log(error);
  }
}