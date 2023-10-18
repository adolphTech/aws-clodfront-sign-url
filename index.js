import express from "express";
import multer from "multer";
import "dotenv/config";
import crypto from "crypto";
import sharp  from "sharp";




import { connection } from "./db/mongoose.js";
import {Post} from "./model/Post.model.js"
import { S3Client, PutObjectCommand ,GetObjectCommand} from "@aws-sdk/client-s3";

import {getSignedUrl} from "@aws-sdk/cloudfront-signer"
// import {getSignedUrl} from "@aws-sdk/s3-request-presigner";


const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

const s3 = new S3Client({
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
  region: bucketRegion,
});

const app = express();
app.use(express.json()); // Parse JSON
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// app.post("/api/posts", upload.single("image"), async (req, res) => {
//     const {caption} = req.body
//   console.log("req.body", req.body);
//   console.log("req.file", req.file);

// //   resize image
// const buffer = await sharp(req.file.buffer).resize({height:1920,width:1080,fit:"contain"}).toBuffer()
// // const imageName = randomImageName()

// // Generate a unique folder name (e.g., using a timestamp)
// // const folderName = randomImageName();

// // Generate a unique image name for this upload
// // const imageName = `${folderName}/${randomImageName()}`;

// const imageName= randomImageName()
  
    

//   const params = {
//     Bucket: bucketName,
//     Key: imageName,
//     Body: buffer,
//     ContentType: req.file.mimetype,
//   };
//   const command = new PutObjectCommand(params);

//   await s3.send(command);


//   const newPost = new Post({
//     imageName,
//     caption,
//   });

//   const savedPost = await newPost.save();

//   res.send(savedPost);
// });
 
// app.get("/api/posts", async (req, res) => {
//     try {
//       const posts = await Post.find({});
  
//       // Map the posts to add signed URLs
//       // const signedPosts = await Promise.all(
//       //   posts.map(async (post) => {
//       //     const getObjectParams = {
//       //       Bucket: bucketName,
//       //       Key: post.imageName, 
//       //     }; 
  
//       //     const command = new GetObjectCommand(getObjectParams);
//       //     const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  
//       //     // Create a new object with the original post data and the signed URL
//       //     return {
//       //       ...post.toObject(), // Convert Mongoose document to plain object
//       //       imageUrl: url,
//       //     };
//       //   })
//       // );

//       for (const post of posts){
//         post.imageUrl = getSignedUrl({
//           url:"https://d219llnsf16hmq.cloudfront.net" + post.imageName,
//           expires:new Date(Date.now()+1000 * 60 * 60 *24),
//           privateKey:process.env.CLOUDFRONT_PRIVATE_KEY,
//           keyPairId:process.env.CLOUDFRONT_KEY_PAIR_ID
//         })
//       } 
  
//       res.json(posts);
//     } catch (error) {
//       console.error('Error fetching and signing posts:', error);
//       res.status(500).json({ error: 'Internal Server Error' });
//     }
//   });


app.post("/api/posts", upload.single("image"), async (req, res) => {
  try {
    const { caption } = req.body;
    console.log("req.body", req.body);
    console.log("req.file", req.file);

    // Resize image
    const buffer = await sharp(req.file.buffer)
      .resize({ height: 1920, width: 1080, fit: "contain" })
      .toBuffer();

    const imageName = randomImageName();
 
    const params = {
      Bucket: bucketName, 
      Key: imageName,
      Body: buffer,
      ContentType: req.file.mimetype,
    };
    const command = new PutObjectCommand(params);

    // Upload the image to S3
    await s3.send(command);

    const newPost = new Post({
      imageName,
      caption,
    });

    // Save the post to the database
    const savedPost = await newPost.save();

    res.json(savedPost); // Send the response to the user after successful upload and save
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// app.get("/api/posts", async (req, res) => {
//     try {
//         const posts = await Post.find({});

//         for (const post of posts) {
//             const getObjectParams = {
//                 Bucket: bucketName, 
//                 Key: post.imageName,
//             };

//             const command = new GetObjectCommand(getObjectParams);
//             const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

//             // Add the signed URL to the post
//             post.imageUrl = url;
//         }

//         res.json(posts);
//     } catch (error) {
//         console.error('Error fetching and signing posts:', error);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// });

app.get("/api/posts", async (req, res) => {
  try {
    const posts = await Post.find({});
    
    const signedUrlPromises = posts.map(async (post) => {
      const imageUrl = "https://d219llnsf16hmq.cloudfront.net/" + post.imageName;
      return getSignedUrl({
        url: imageUrl,
        dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24),
        privateKey: process.env.CLOUDFRONT_PRIVATE_KEY,
        keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
      });
    });

    const signedUrls = await Promise.all(signedUrlPromises);

    // Create a new array with imageUrl property added
    const postsWithImageUrl = posts.map((post, index) => ({
      ...post.toObject(), // Convert Mongoose document to plain JavaScript object
      imageUrl: signedUrls[index],
    }));

    res.send(postsWithImageUrl);
  } catch (error) {
    console.error('Error fetching and signing posts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




// app.get("/api/posts", async (req, res) => {
//   try {
//     const posts = await Post.find({});
    
    
//     for await (const post of posts) {
//       post.imageUrl = getSignedUrl({
//         url: "https://d219llnsf16hmq.cloudfront.net/" + post.imageName,
//         dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24),
//         privateKey: process.env.CLOUDFRONT_PRIVATE_KEY,
//         keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
//       });
//       // const mln = post.imageUrl
//     }

//     res.send(posts);
//   } catch (error) {
//     console.error('Error fetching and signing posts:', error);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// });
 


app.delete("/api/posts/:id", async (req, res) => {
  const id = req.params.id;
  res.send({});
});
 
app.listen(8080, async () => {
  await connection();
  console.log("listen on port 8080");
});
