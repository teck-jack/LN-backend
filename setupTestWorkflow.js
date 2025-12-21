const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Case = require('./models/Case');
const Service = require('./models/Service');
const WorkflowTemplate = require('./models/WorkflowTemplate');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('Connection error:', err.message);
        process.exit(1);
    }
};

const setup = async () => {
    await connectDB();

    try {
        // 1. Create a Test Workflow Template
        const template = await WorkflowTemplate.create({
            name: "Test Verification Workflow",
            description: "A sample workflow to test the frontend integration",
            serviceType: "671607593d62351b69d46078", // Just a placeholder, will be updated to match case's service
            steps: [
                {
                    stepName: "Initial Review",
                    order: 1,
                    estimatedDuration: 120, // minutes
                    checklistItems: [
                        { title: "Verify User ID", isOptional: false, order: 1 },
                        { title: "Check Document Clarity", isOptional: false, order: 2 }
                    ]
                },
                {
                    stepName: "Processing",
                    order: 2,
                    estimatedDuration: 240,
                    checklistItems: [
                        { title: "Submit to Portal", isOptional: false, order: 1 },
                        { title: "Generate Receipt", isOptional: true, order: 2 }
                    ]
                }
            ],
            totalEstimatedDuration: 360,
            isActive: true,
            createdBy: new mongoose.Types.ObjectId() // Placeholder
        });

        console.log('Created Template:', template.name);

        // 2. Find the Case
        // You can change this to find a specific case if needed
        const caseItem = await Case.findOne().sort({ createdAt: -1 });

        if (!caseItem) {
            console.log('No cases found!');
            process.exit(1);
        }

        console.log('Found Case:', caseItem.caseId);

        // 3. Assign Template to Case
        caseItem.workflowTemplateId = template._id;
        await caseItem.save();

        console.log('SUCCESS! Assigned workflow template to case.');
        console.log('Go to your frontend Employee Dashboard -> Case Details -> Progress Tab to see the new Checklist Panel!');

    } catch (error) {
        console.error('Error:', error);
    }

    process.exit();
};

setup();
