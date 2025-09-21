# Hướng dẫn điều chỉnh height của toàn bộ web project

## Tổng quan
Dự án này sử dụng nhiều phương pháp để điều chỉnh height của các components và layouts. Dưới đây là hướng dẫn chi tiết về các methods hiện có và cách sử dụng chúng.

## Method 1: Sử dụng Tailwind CSS classes

### Height classes hiện tại:
- `h-screen` → `100vh` (toàn màn hình, cố định)
- `min-h-[800px]` → Minimum 800px, có thể expand
- `h-auto` → Auto height theo content
- `max-h-[1200px]` → Maximum height limit

### Files đã được modify:
- `client/src/pages/clustering.tsx` - Main container từ `h-screen` → `min-h-[800px] h-auto`
- `client/src/components/company-rating.tsx` - Layout container height adjustments

### Cách apply:
```tsx
// Before (cố định viewport height)
<div className="h-screen overflow-hidden">

// After (flexible height)
<div className="min-h-[800px] h-auto overflow-auto">
```

## Method 2: Responsive height classes

### Responsive breakpoints:
```tsx
className="
  min-h-[600px] 
  md:min-h-[700px] 
  lg:min-h-[800px] 
  xl:min-h-[900px]
  h-auto 
  overflow-auto
"
```

### Mobile-first approach:
- Mobile: 600px minimum
- Tablet: 700px minimum
- Desktop: 800px minimum
- Large desktop: 900px minimum

## Method 3: Custom CSS classes trong index.css

### Classes được thêm vào `client/src/index.css`:

```css
/* Custom height classes for flexible layout */
.app-container {
  min-height: 100vh;
  height: auto;
}

.app-container-fixed {
  height: 100vh;
  overflow: hidden;
}

.app-container-custom {
  min-height: 800px;
  height: auto;
  max-height: 1200px;
}

.sidebar-flex {
  min-height: 800px;
}

.content-flex {
  min-height: 800px;
}
```

### Cách sử dụng:
```tsx
// Flexible container với min/max constraints
<div className="app-container-custom">

// Fixed sidebar height
<div className="sidebar-flex">

// Content area với flexible height
<div className="content-flex">
```

## Method 4: Plotly chart height adjustments

### Props-based height control:
```tsx
interface VisualizationProps {
  height?: number; // Default: 800
  width?: number;  // Default: calculated from container
}

// Usage
<ClusterVisualization 
  height={600}  // Custom height
  data={clusterData} 
/>
```

### Layout object height:
```tsx
const layout = {
  ...otherProps,
  height: height || 800, // Configurable
  autosize: true,
  responsive: true
};
```

### Files với Plotly height settings:
- `cluster-visualization.tsx` - Default height: 1000px
- `simple-cluster-visualization.tsx` - Default height: 600px
- `company-rating.tsx` - Chart height: 400px
- `scatter-plot.tsx` - Download image height: 800px

## Method 5: CSS custom properties (Global control)

### Thêm vào `client/src/index.css`:
```css
:root {
  --app-min-height: 800px;
  --sidebar-height: 800px;
  --chart-height: 600px;
  --mobile-min-height: 600px;
}

@media (max-width: 768px) {
  :root {
    --app-min-height: var(--mobile-min-height);
    --sidebar-height: auto;
    --chart-height: 400px;
  }
}
```

### Sử dụng trong components:
```tsx
<div style={{ minHeight: 'var(--app-min-height)' }}>
<div style={{ height: 'var(--chart-height)' }}>
```

## Best Practices

### 1. Layout containers:
- Sử dụng `min-h-[800px] h-auto overflow-auto` cho main containers
- Tránh `h-screen` trên mobile devices
- Luôn có `overflow-auto` cho scrollable content

### 2. Sidebar components:
- Desktop: Fixed minimum height cho consistency
- Mobile: Auto height với proper spacing

### 3. Chart components:
- Responsive height theo container size
- Configurable height props
- Mobile-friendly defaults

### 4. Testing checklist:
- [ ] Desktop browser - all screen sizes
- [ ] Mobile devices - portrait/landscape
- [ ] Content overflow scenarios
- [ ] Responsive breakpoints
- [ ] Chart responsiveness

## Troubleshooting

### Common issues:
1. **Content cut off**: Add `overflow-auto` to containers
2. **Fixed height too small**: Switch to `min-h-*` classes
3. **Charts not responsive**: Check container sizing và Plotly `autosize: true`
4. **Mobile layout broken**: Use responsive height classes

### Debug commands:
```bash
# Search for height-related classes
grep -r "h-screen\|min-h-\|max-h-" client/src/

# Find Plotly height settings
grep -r "height.*[0-9]" client/src/components/
```

## Future improvements

### Có thể implement:
1. **Dynamic height calculation** dựa trên viewport size
2. **User preferences** cho height settings
3. **Advanced responsive** với container queries
4. **Accessibility improvements** cho height constraints