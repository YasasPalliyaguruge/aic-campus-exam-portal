import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export const DatabaseDebugger = () => {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const collections = ['users', 'exams', 'programs', 'sessions'];
      const result: any = {};

      for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, collectionName));
        result[collectionName] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      setData(result);
      console.log('📊 Database contents:', result);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Database Debugger</h1>
        <Button onClick={fetchData} loading={loading}>
          🔄 Refresh Data
        </Button>
      </div>

      {Object.keys(data).map(collectionName => (
        <Card key={collectionName}>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            📁 {collectionName} ({data[collectionName]?.length || 0} documents)
          </h2>
          <div className="overflow-x-auto">
            <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-auto max-h-96">
              {JSON.stringify(data[collectionName], null, 2)}
            </pre>
          </div>
        </Card>
      ))}

      {Object.keys(data).length === 0 && !loading && (
        <div className="text-center text-gray-500 py-12">
          <p>No data found. Click refresh to load database contents.</p>
        </div>
      )}
    </div>
  );
};
