import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../src/utils/AppError.js";

const createMulterUploader = (folderName) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `uploads/${folderName}`);
    },
    filename: (req, file, cb) => {
      cb(null, uuidv4() + " - " + file.originalname);
    },
  });

  function fileFilter(req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new AppError("Not supporting this mimetype", 401), false);
    }
  }

  const upload = multer({ storage, fileFilter });

  return upload;
};

// For Single File Upload
export const uploadSingleFile = (fieldName, folderName) => {
  return createMulterUploader(folderName).single(fieldName);
};

// For Multiple Fields Upload
export const uploadMultipleFiles = (arrayOfFields, folderName) => {
  return createMulterUploader(folderName).fields(arrayOfFields);
};
