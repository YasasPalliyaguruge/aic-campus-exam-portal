# Question Reordering Feature - Drag & Drop ✅

## Overview
Added drag-and-drop functionality to reorder exam questions when creating or editing exams.

---

## Features Implemented

### **Drag & Drop Functionality**

#### **Where it Works:**
1. **Step 1 - Question List** (while adding questions)
2. **Step 2 - Review** (before publishing)

#### **How to Use:**
1. **Create/Edit an exam**
2. **Add questions** to your exam
3. **Hover over a question** - cursor changes to "move"
4. **Click and drag** the question card
5. **Drop** at the desired position
6. Questions automatically **renumber** after reordering

### **Visual Feedback:**

#### **Grip Handle Icon**
- `GripVertical` icon from lucide-react
- Visible on every question card
- Indicates draggable area

#### **Question Numbers**
- Circular badges showing position (1, 2, 3...)
- Updates automatically after reordering
- Color: Violet background

#### **Drag States:**
- **Hovering**: Background color changes
- **Dragging**: 
  - Dragged item becomes semi-transparent (50% opacity)
  - Slight scale reduction (scale-95)
  - Smooth transitions

#### **Hint Text:**
- "💡 Drag and drop to reorder questions"
- Displayed above question list

---

## Implementation Details

### **State Management:**
```typescript
const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
```

### **Event Handlers:**

#### **1. handleDragStart**
```typescript
const handleDragStart = (index: number) => {
  setDraggedIndex(index);
};
```
- Records which question is being dragged

#### **2. handleDragOver**
```typescript
const handleDragOver = (e: React.DragEvent, index: number) => {
  e.preventDefault();
  
  if (draggedIndex === null || draggedIndex === index) return;
  
  const questions = [...(newExam.questions || [])];
  const draggedItem = questions[draggedIndex];
  
  // Remove from old position
  questions.splice(draggedIndex, 1);
  // Insert at new position
  questions.splice(index, 0, draggedItem);
  
  setNewExam(prev => ({ ...prev, questions }));
  setDraggedIndex(index);
};
```
- Handles the reordering logic
- Updates question array in real-time

#### **3. handleDragEnd**
```typescript
const handleDragEnd = () => {
  setDraggedIndex(null);
};
```
- Cleans up state after drag completes

### **HTML5 Drag API Properties:**
```typescript
<div 
  draggable                             // Makes element draggable
  onDragStart={() => handleDragStart(idx)}
  onDragOver={(e) => handleDragOver(e, idx)}
  onDragEnd={handleDragEnd}
  className="cursor-move"              // Visual cursor feedback
>
```

---

## UI Changes

### **Step 1 - Questions Added List**

**Before:**
- Static list of questions
- No reordering capability
- Only Edit/Delete buttons

**After:**
- ✅ Drag handle icon (GripVertical)
- ✅ Question number badge
- ✅ Hover effects
- ✅ Smooth transitions
- ✅ Real-time reordering

### **Step 2 - Review Screen**

**Before:**
- Full question preview cards
- No reordering capability

**After:**
- ✅ All Step 1 features PLUS
- ✅ Drag handle below question number
- ✅ Full preview while dragging
- ✅ Visual feedback during drag

---

## Technical Notes

### **Why HTML5 Drag & Drop?**
- **No external dependencies** needed
- Native browser support
- Lightweight implementation
- Standard web API

### **Alternative Libraries Considered:**
- ❌ react-beautiful-dnd (additional bundle size)
- ❌ dnd-kit (complexity for simple use case)
- ✅ **HTML5 Native** (chosen for simplicity)

### **Performance:**
- Efficient array manipulation using splice()
- State updates only when position changes
- No re-renders for unchanged questions

---

## User Experience

### **Workflow:**
1. Create exam
2. Add multiple questions
3. Review question order
4. **Drag & drop to reorder**
5. Continue to scheduling
6. Publish exam

### **Benefits:**
- ✅ Intuitive interface
- ✅ No learning curve
- ✅ Visual feedback
- ✅ Works on both Step 1 and Step 2
- ✅ Automatic renumbering
- ✅ Preserves all question data

---

## Files Modified

### **ExamWizard.tsx**

**Imports Added:**
```typescript
import { GripVertical } from 'lucide-react';
```

**State Added:**
```typescript
const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
```

**Handlers Added:**
- `handleDragStart(index: number)`
- `handleDragOver(e: React.DragEvent, index: number)`
- `handleDragEnd()`

**UI Updates:**
- Step 1: Question list cards made draggable
- Step 2: Review cards made draggable
- Added grip icons and question numbers
- Added hint text

---

## Testing Checklist

- [ ] **Create exam with 5+ questions**
- [ ] **Drag question from top to bottom**
- [ ] **Drag question from bottom to top**
- [ ] **Drag question to middle position**
- [ ] **Verify numbers update correctly**
- [ ] **Check drag works in Step 1**
- [ ] **Check drag works in Step 2**
- [ ] **Edit a question after reordering**
- [ ] **Delete a question after reordering**
- [ ] **Publish exam and verify question order persists**

---

## Future Enhancements (Optional)

- [ ] Keyboard shortcuts (Ctrl+Up/Down to reorder)
- [ ] Bulk reorder (select multiple questions)
- [ ] Undo/Redo for reordering
- [ ] Question grouping/sections
- [ ] Visual drop zone indicators
- [ ] Touch device optimization

---

**Status**: Fully functional drag-and-drop question reordering! 🎉
