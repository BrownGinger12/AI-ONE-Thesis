import { useEffect, useRef, useState } from "react";
import { database, db } from "../firebase";
import { onValue, ref, update } from "firebase/database";
import OpenAI from "openai";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import {
  Activity,
  CheckCircle,
  Droplets,
  Eye,
  Thermometer,
  Wind,
} from "lucide-react";

const PlantMonitoring = () => {
  const [selectedValue, setSelectedValue] = useState("none");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [sensorReadings, setSensorReadings] = useState<any>({});

  const [plantsDetected, setPlantsDetected] = useState<any[]>([]);
  const [detectionData, setDetectionData] = useState<any[]>([]);

  const [detections, setDetections] = useState("detect");

  const [plantIndex, setPlantIndex] = useState(0);

  const [analysisData, setAnalysisData] = useState<any>({});

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [checkButton, setCheckButton] = useState(false);

  const fetchAiResponse = async (input: string) => {
    try {
      const openai = new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Identify the plant if its pechay and malabar spinach, the plants will be shown are either of those 2 so just classify it, Identify if there are pests and diseases then recommend a pesticide just say there's is no diseases/pest if there's none. response format Plant:[name with bracket] Disease/Pest:[disease inside a bracket] Pesticide:[inside this bracket]",
              },
              {
                type: "image_url",
                image_url: {
                  url: input,
                },
              },
            ],
          },
        ],
      });

      setAiResponse(completion.choices[0].message.content);
    } catch (error) {
      console.error("Error fetching aiResponse:", error);
    }
  };

  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob); // This converts the blob to base64
    });
  };

  const captureImage = async (): Promise<string | null> => {
    try {
      // Fetch the image from the backend
      const response = await fetch("http://192.168.0.82:5000//capture_image");
      const blob = await response.blob();

      const base64 = await convertBlobToBase64(blob);

      return base64;
    } catch (error) {
      console.error("Error capturing image:", error);
      return null; // Return null in case of error
    }
  };

  useEffect(() => {
    // Replace "your_data_path/specific_document_id" with the path to your single document
    const documentRef = ref(database, "users");

    const unsubscribe = onValue(documentRef, (snapshot) => {
      const documentData = snapshot.val();
      if (documentData) {
        setSensorReadings({ id: snapshot.key!, ...documentData });
        console.log(sensorReadings);
      } else {
        setSensorReadings({}); // Handle case where the document doesn't exist
      }
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const collectionRef = collection(db, "plantData");

    // Setup the collection snapshot listener
    const unsubscribe = onSnapshot(
      collectionRef,
      (querySnapshot) => {
        const docsData: any[] = [];
        querySnapshot.forEach((doc) => {
          docsData.push({ ...doc.data(), id: doc.id }); // Extract document data
        });
        setPlantsDetected(docsData);
        setSelectedValue(docsData[docsData.length - 1].id);
        setPlantIndex(docsData.length);
      },
      (error) => {
        console.error("Error fetching collection data:", error);
      }
    );

    // Cleanup the listener when the component is unmounted
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const collectionRef = collection(db, `plantData/${selectedValue}/data`);

    // Setup the collection snapshot listener
    const unsubscribe = onSnapshot(
      collectionRef,
      (querySnapshot) => {
        const docsData: any[] = [];
        querySnapshot.forEach((doc) => {
          docsData.push({ ...doc.data(), id: doc.id }); // Extract document data
        });
        setDetectionData(docsData);
      },
      (error) => {
        console.error("Error fetching collection data:", error);
      }
    );

    // Cleanup the listener when the component is unmounted
    return () => unsubscribe();
  }, [selectedValue]);

  const getCustomFormattedDateTime = () => {
    const currentDate = new Date();

    // Custom format (example: "2025-01-20 12:34:56")
    const customFormattedDateTime =
      currentDate
        .toLocaleString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(",", "")
        .replace("/", "-")
        .replace("/", "-") +
      currentDate
        .toLocaleString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
        .replace(",", "");

    return customFormattedDateTime;
  };

  const handleAddData = async (data: any, col: string) => {
    try {
      // Specify the collection reference
      const collectionRef = collection(db, col);

      // Add data to the collection
      const docRef = await addDoc(collectionRef, data);
    } catch (error) {
      console.error("Error adding document:", error);
    }
  };

  const handleAddDataWithId = async (data: any, col: string, id: string) => {
    try {
      // Specify the collection reference
      const collectionRef = collection(db, col);

      // Add data to the collection
      const docRef = doc(collectionRef, id);
      await setDoc(docRef, data);
    } catch (error) {
      console.error("Error adding document:", error);
    }
  };

  useEffect(() => {
    if (detections === "check") {
      if (aiResponse) {
        const regex = /\[([^\]]+)\]/g; // Match text inside square brackets
        const matches = Array.from(aiResponse.matchAll(regex)).map(
          (match) => match[1]
        );

        const plantData = {
          Plant: matches[0],
          Disease: matches[1],
          Pesticide: matches[2],
          moisture: sensorReadings.moisture,
        };
        setAnalysisData(plantData);
        handleAddDataWithId(
          plantData,
          `plantData/${selectedValue}/data`,
          getCustomFormattedDateTime()
        );
        setDetections("detect");
        setCheckButton(false);
        updateDocument("plant_to_detect", { detect: 0 });
        updateDocument("users", { detection: "none" });
      }
    } else if (detections === "detect") {
      if (aiResponse) {
        const regex = /\[([^\]]+)\]/g; // Match text inside square brackets
        const matches = Array.from(aiResponse.matchAll(regex)).map(
          (match) => match[1]
        );

        const plantData = {
          Plant: matches[0],
          Disease: matches[1],
          Pesticide: matches[2],
          moisture: sensorReadings.moisture,
        };

        setAnalysisData(plantData);
        const id = getCustomFormattedDateTime();
        handleAddDataWithId({ name: matches[0] }, "plantData/", id);

        handleAddDataWithId(
          plantData,
          `plantData/${getCustomFormattedDateTime()}/data`,
          id
        );
        updateDocument("users", { detection: "none" });
      }
    }

    setLoadingAnalysis(false);
  }, [aiResponse]);

  const handleCapture = async () => {
    const url = await captureImage();
    if (url) {
      setLoadingAnalysis(true);
      fetchAiResponse(url);
    }
    if (!url) {
      console.log("Failed to capture the image.");
    }
  };

  const updateDocument = async (
    path: string,
    data: Record<string, any>
  ): Promise<void> => {
    try {
      const docRef = ref(database, path); // Reference to the document
      await update(docRef, data); // Update the document
      console.log("Document updated successfully");
    } catch (error) {
      console.error("Error updating document:", error);
    }
  };

  useEffect(() => {
    if (sensorReadings.detection !== "none") {
      handleCapture();
    }
  }, [sensorReadings]);

  return (
    <div className="h-full bg-gradient-to-b from-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 p-4 text-white">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center">
            <Activity className="mr-2 text-green-400" />
            AIone: Greenhouse Management System
          </h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Thermometer className="text-orange-400 mr-1" />
              <span>24°C</span>
            </div>
            <div className="flex items-center">
              <Droplets className="text-blue-400 mr-1" />
              <span>68%</span>
            </div>
            <div className="flex items-center">
              <Wind className="text-gray-400 mr-1" />
              <span>3 km/h</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="container mx-auto p-6 flex flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
          {/* Live Camera Feed */}
          <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-700 text-white font-semibold flex items-center justify-between">
              <span className="flex items-center">
                <Eye className="mr-2" /> Live Camera Feed
              </span>
              <span className="bg-red-500 px-2 py-1 rounded-full text-xs animate-pulse">
                LIVE
              </span>
            </div>
            <div className="p-4 flex-1 flex items-center justify-center bg-slate-900">
              <div className="relative h-72 w-full rounded overflow-hidden">
                <img
                  src="/api/placeholder/400/320"
                  alt="Plant camera feed"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  Camera 01
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-800">
              <select
                value={selectedValue}
                disabled={checkButton}
                onChange={(e) => {
                  setSelectedValue(e.target.value);
                  setPlantIndex(e.target.selectedIndex + 1);
                }}
                className="w-full px-4 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="" disabled selected>
                  Select Plant to Analyze
                </option>
                {plantsDetected.map((item, index) => (
                  <option value={item.id} key={index}>
                    {item.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {}}
                disabled={checkButton}
                className={`mt-3 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-all duration-300 flex items-center justify-center ${
                  checkButton
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:scale-[1.02]"
                }`}
              >
                <CheckCircle className="mr-2" /> Analyze Selected Plant
              </button>
            </div>
          </div>

          {/* Analysis Results */}
          <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-700 text-white font-semibold">
              Current Analysis Results
            </div>
            <div className="p-6 flex-1 flex flex-col">
              {loadingAnalysis ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-white font-medium">
                    Analyzing plant health...
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="mb-6 bg-slate-700 rounded-lg p-4">
                    <h3 className="text-green-400 text-lg font-semibold mb-2">
                      Plant Information
                    </h3>
                    <div className="flex items-center justify-between py-2 border-b border-slate-600">
                      <span className="text-slate-400">Species:</span>
                      <span className="text-white font-medium">
                        {analysisData.Plant}
                      </span>
                    </div>
                  </div>

                  <div className="mb-6 bg-slate-700 rounded-lg p-4">
                    <h3 className="text-yellow-400 text-lg font-semibold mb-2">
                      Health Status
                    </h3>
                    <div className="flex items-center justify-between py-2 border-b border-slate-600">
                      <span className="text-slate-400">Condition:</span>
                      <span
                        className={`font-medium ${
                          analysisData.Disease === "Healthy"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {analysisData.Disease}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-600">
                      <span className="text-slate-400">Treatment:</span>
                      <span className="text-white font-medium">
                        {analysisData.Pesticide}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-700 rounded-lg p-4">
                    <h3 className="text-blue-400 text-lg font-semibold mb-2">
                      Soil Conditions
                    </h3>
                    <div className="flex items-center justify-between py-2 border-b border-slate-600">
                      <span className="text-slate-400">Moisture:</span>
                      <span className="text-white font-medium">
                        {analysisData.moisture}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* History & Records */}
          <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-700 text-white font-semibold">
              Analysis History
            </div>
            <div className="flex-1 overflow-y-auto">
              {detectionData.length > 0 ? (
                detectionData.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => setAnalysisData(item)}
                    className={`p-4 border-b border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer ${
                      item.id === analysisData.id ? "bg-slate-700" : ""
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium text-white">{item.id}</h3>
                      <span
                        className={`text-sm px-2 py-1 rounded-full ${
                          item.Disease === "Healthy"
                            ? "bg-green-900 text-green-300"
                            : "bg-red-900 text-red-300"
                        }`}
                      >
                        {item.Disease}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      Plant: {item.Plant}
                    </p>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                      <span>Treatment: {item.Pesticide}</span>
                      <span>{item.moisture.split(" ")[0]}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-500">
                  No analysis records found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 text-center text-slate-500 text-sm">
        AIone Greenhouse Management System &copy; 2025 | Thesis Project
      </footer>

      {/* Loading Overlay */}
      {loadingAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-lg shadow-lg flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-lg font-medium text-white">
              Analyzing Plant Health
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Please wait while AI processes the image...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantMonitoring;
