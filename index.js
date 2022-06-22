import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { GridFsStorage } from "multer-gridfs-storage";
import Grid from "gridfs-stream";
import methodOverride from "method-override";
import {ObjectId} from "mongodb";

dotenv.config();
// import fileUpload from "./routes/FileUpload.js";
import { connect } from "http2";

const app = express();

// middlewares
app.use(bodyParser.json({ limit: "30mb", extended: true }));
app.use(methodOverride("_method"));
app.use(bodyParser.urlencoded({ limit: "30mb", extended: true }));
app.use(cors());

// routes

// app.use("/upload", fileUpload);

const URL = process.env.ATLAS_URI;
const PORT = process.env.PORT || 5000;

//connect to mongodb
const conn = mongoose.createConnection(URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// init gfs
let gfs, gridfsBucket;

conn.once("open", () => {
    // initialize stream
    gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: "uploads",
    });

    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection("uploads");
});

// create the storage engine multer-gridfs-storage
const storage = new GridFsStorage({
    url: URL,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename =
                    buf.toString("hex") + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: "uploads",
                };
                resolve(fileInfo);
            });
        });
    },
});
const upload = multer({ storage });

// route post to upload file
// we're just uploadin the single file but with multer we can
// upload many files

app.post("/upload", upload.single("file"), (req, res) => {
    // console.log(res.json({file: req.file}));
    res.redirect(process.env.BASE_URL || "http://localhost:3000/");
});

app.get("/files", (req, res) => {
    gfs.files.find().toArray((err, files) => {
        if (!files || files.length === 0) {
            return res.status(404).json({ err: "No files exist" });
        }
        return res.json(files);
    });
});

//
app.get("/files/:filename", (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length <= 0) {
            return res.status(404).json({ err: "No file exists" });
        }

        return res.json(file);
    });
});

// get /image/:filename
app.get("/image/:filename", (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length <= 0) {
            return res.status(404).json({ err: "No file exists" });
        }
        // check if image
        if (
            file.contentType === "image/jpeg" ||
            file.contentType === "image/png"
        ) {
            // read output to browser
            const readStream = gridfsBucket.openDownloadStream(file._id);
            readStream.pipe(res);
        } else {
            res.status(404).json({
                err: "Not an image",
            });
        }
        // return res.json(file);
    });
});

app.delete("/files/:_id", (req, res) => {
    // const file = gfs.files.findOne({ filename: req.params._id });
    const gsfb = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: "uploads", 
    });
    // gsfb.delete(req.params._id, (err, gridStore) => {
    //     if (err) return res.status(404).json({ err: err });
    //     res.redirect("http://localhost:3000");
    // });
    gsfb.delete(ObjectId(req.params._id), (err, gridStore)=>{
        if(err) return res.status(404).json({err:err});
        res.redirect("http://localhost:3000");
    });
});

//  connect to mongodb atlas
app.listen(PORT, () => console.log(`server running on port number: ${PORT}`));

//  this doesn't show any unnecessary errors
// mongoose.set("useFindAndModify", false)
