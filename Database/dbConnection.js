import { connect } from "mongoose";

const connectToMongoDB = async (connectString) => {
    try {
        const instance = await connect(connectString)
        console.log(`\nDatabase Connection Host : ${instance.connection.host}`)
    } catch (error) {
        console.log(`Database Connection Error : ${error.message}`);
        process.exit(1)
    }
}


export default connectToMongoDB;