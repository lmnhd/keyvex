'use client';

import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DynamicCardStylingTestPage() {
  // Card states
  const [card1Classes, setCard1Classes] = useState("bg-card text-card-foreground border");
  const [card2Classes, setCard2Classes] = useState("bg-blue-700 text-blue-100 border-blue-500");
  const [inputCard1Classes, setInputCard1Classes] = useState(card1Classes);
  const [inputCard2Classes, setInputCard2Classes] = useState(card2Classes);

  // Input component states
  const [inputComp1Classes, setInputComp1Classes] = useState("border-gray-300 dark:border-gray-600");
  const [inputComp2Classes, setInputComp2Classes] = useState("border-green-500 text-green-700 focus:ring-green-500");
  const [tempInputComp1Classes, setTempInputComp1Classes] = useState(inputComp1Classes);
  const [tempInputComp2Classes, setTempInputComp2Classes] = useState(inputComp2Classes);

  // Select component states
  const [selectComp1Classes, setSelectComp1Classes] = useState("w-[180px]");
  const [selectComp2Classes, setSelectComp2Classes] = useState("w-[280px] bg-yellow-100 border-yellow-400 text-yellow-700");
  const [tempSelectComp1Classes, setTempSelectComp1Classes] = useState(selectComp1Classes);
  const [tempSelectComp2Classes, setTempSelectComp2Classes] = useState(selectComp2Classes);

  // Card handlers
  const handleApplyCard1 = () => setCard1Classes(inputCard1Classes);
  const handleApplyCard2 = () => setCard2Classes(inputCard2Classes);

  // Input component handlers
  const handleApplyInputComp1 = () => setInputComp1Classes(tempInputComp1Classes);
  const handleApplyInputComp2 = () => setInputComp2Classes(tempInputComp2Classes);

  // Select component handlers
  const handleApplySelectComp1 = () => setSelectComp1Classes(tempSelectComp1Classes);
  const handleApplySelectComp2 = () => setSelectComp2Classes(tempSelectComp2Classes);

  return (
    <div className="container mx-auto p-8 space-y-12 bg-background text-foreground">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dynamic Component Styling Test</h1>
        <p className="text-muted-foreground">
          Test applying Tailwind CSS classes directly to various UI components.
        </p>
      </header>

      {/* Cards Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-center text-gray-800 dark:text-gray-200">Card Components</h2>
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Card 1 Section */}
          <div className="space-y-4 p-6 border rounded-lg shadow-md bg-white dark:bg-gray-800">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Card 1</h3>
            <Card className={card1Classes}>
              <CardHeader><CardTitle>Dynamic Card 1</CardTitle></CardHeader>
              <CardContent><p>Current: <code className="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded text-gray-700 dark:text-gray-300">{card1Classes}</code></p></CardContent>
            </Card>
            <div className="space-y-2">
              <Label htmlFor="card1Input" className="text-gray-700 dark:text-gray-300">Classes for Card 1:</Label>
              <Input id="card1Input" type="text" value={inputCard1Classes} onChange={(e) => setInputCard1Classes(e.target.value)} />
              <Button onClick={handleApplyCard1} className="w-full">Apply to Card 1</Button>
            </div>
          </div>
          {/* Card 2 Section */}
          <div className="space-y-4 p-6 border rounded-lg shadow-md bg-white dark:bg-gray-800">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Card 2</h3>
            <Card className={card2Classes}>
              <CardHeader><CardTitle>Dynamic Card 2</CardTitle></CardHeader>
              <CardContent><p>Current: <code className="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded text-gray-700 dark:text-gray-300">{card2Classes}</code></p></CardContent>
            </Card>
            <div className="space-y-2">
              <Label htmlFor="card2Input" className="text-gray-700 dark:text-gray-300">Classes for Card 2:</Label>
              <Input id="card2Input" type="text" value={inputCard2Classes} onChange={(e) => setInputCard2Classes(e.target.value)} />
              <Button onClick={handleApplyCard2} className="w-full">Apply to Card 2</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Inputs Section */}
      <section className="space-y-6 border-t pt-8 mt-8">
        <h2 className="text-2xl font-semibold text-center text-gray-800 dark:text-gray-200">Input Components</h2>
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Input Component 1 Section */}
          <div className="space-y-4 p-6 border rounded-lg shadow-md bg-white dark:bg-gray-800">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Input Component 1</h3>
            <Input placeholder="Test Input 1" className={inputComp1Classes} />
            <p className="text-xs text-muted-foreground">Current: <code className="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded text-gray-700 dark:text-gray-300">{inputComp1Classes}</code></p>
            <div className="space-y-2">
              <Label htmlFor="inputComp1ClassesInput" className="text-gray-700 dark:text-gray-300">Classes for Input 1:</Label>
              <Input id="inputComp1ClassesInput" type="text" value={tempInputComp1Classes} onChange={(e) => setTempInputComp1Classes(e.target.value)} />
              <Button onClick={handleApplyInputComp1} className="w-full">Apply to Input 1</Button>
            </div>
          </div>
          {/* Input Component 2 Section */}
          <div className="space-y-4 p-6 border rounded-lg shadow-md bg-white dark:bg-gray-800">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Input Component 2</h3>
            <Input placeholder="Test Input 2" className={inputComp2Classes} />
            <p className="text-xs text-muted-foreground">Current: <code className="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded text-gray-700 dark:text-gray-300">{inputComp2Classes}</code></p>
            <div className="space-y-2">
              <Label htmlFor="inputComp2ClassesInput" className="text-gray-700 dark:text-gray-300">Classes for Input 2:</Label>
              <Input id="inputComp2ClassesInput" type="text" value={tempInputComp2Classes} onChange={(e) => setTempInputComp2Classes(e.target.value)} />
              <Button onClick={handleApplyInputComp2} className="w-full">Apply to Input 2</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Selects Section */}
      <section className="space-y-6 border-t pt-8 mt-8">
        <h2 className="text-2xl font-semibold text-center text-gray-800 dark:text-gray-200">Select Components</h2>
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Select Component 1 Section */}
          <div className="space-y-4 p-6 border rounded-lg shadow-md bg-white dark:bg-gray-800">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Select Component 1</h3>
            <Select>
              <SelectTrigger className={selectComp1Classes}>
                <SelectValue placeholder="Theme 1" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Current Trigger Classes: <code className="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded text-gray-700 dark:text-gray-300">{selectComp1Classes}</code></p>
            <div className="space-y-2">
              <Label htmlFor="selectComp1ClassesInput" className="text-gray-700 dark:text-gray-300">Classes for Select 1 Trigger:</Label>
              <Input id="selectComp1ClassesInput" type="text" value={tempSelectComp1Classes} onChange={(e) => setTempSelectComp1Classes(e.target.value)} />
              <Button onClick={handleApplySelectComp1} className="w-full">Apply to Select 1</Button>
            </div>
          </div>
          {/* Select Component 2 Section */}
          <div className="space-y-4 p-6 border rounded-lg shadow-md bg-white dark:bg-gray-800">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Select Component 2</h3>
            <Select>
              <SelectTrigger className={selectComp2Classes}>
                <SelectValue placeholder="Theme 2" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="orange">Orange</SelectItem>
                <SelectItem value="purple">Purple</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Current Trigger Classes: <code className="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded text-gray-700 dark:text-gray-300">{selectComp2Classes}</code></p>
            <div className="space-y-2">
              <Label htmlFor="selectComp2ClassesInput" className="text-gray-700 dark:text-gray-300">Classes for Select 2 Trigger:</Label>
              <Input id="selectComp2ClassesInput" type="text" value={tempSelectComp2Classes} onChange={(e) => setTempSelectComp2Classes(e.target.value)} />
              <Button onClick={handleApplySelectComp2} className="w-full">Apply to Select 2</Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">How to Use:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <li>Enter Tailwind CSS utility classes into the input fields.</li>
          <li>For Selects, classes apply to the <code>SelectTrigger</code>.</li>
          <li>Include text colors for contrast and optionally border classes.</li>
          <li>Base component styles will be merged; your classes can override or extend them.</li>
        </ul>
      </div>
    </div>
  );
} 
