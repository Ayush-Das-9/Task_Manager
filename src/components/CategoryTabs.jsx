export default function CategoryTabs({ categories, activeFilter, onFilterChange, onManageCategories }) {
    return (
        <section className="category-management">
            <div className="category-tabs">
                <button
                    className={`cat-tab ${activeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => onFilterChange('all')}
                >
                    All
                </button>
                {categories.map(cat => {
                    const isActive = activeFilter == cat.id
                    return (
                        <button
                            key={cat.id}
                            className={`cat-tab ${isActive ? 'active' : ''}`}
                            onClick={() => onFilterChange(cat.id)}
                            style={isActive ? {} : { borderColor: cat.color, color: cat.color }}
                        >
                            {cat.name}
                        </button>
                    )
                })}
            </div>
            <button className="btn-manage-cats" onClick={onManageCategories}>
                + Category
            </button>
        </section>
    )
}
