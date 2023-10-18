import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  imageName: {
    type: String,
    required: true,
  },
  dateStamp: {
    type: Date,
    default: Date.now,
  },
  caption: {
    type: String,
    required: true,
  },
});

export const Post = mongoose.model('Post', postSchema);

