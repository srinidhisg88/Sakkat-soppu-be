const paginate = (items, page, limit) => {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const paginatedItems = items.slice(startIndex, endIndex);

    const totalPages = Math.ceil(items.length / limit);

    return {
        totalPages,
        currentPage: page,
        items: paginatedItems,
    };
};

module.exports = {
    paginate,
};